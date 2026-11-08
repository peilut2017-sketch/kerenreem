import { NextResponse } from 'next/server';
import { allowRequest } from '@/lib/commerce/rate-limit';
import { processInboundReply, type InboundTrace } from '@/lib/email/inbound';
import { logInboundAttempt } from '@/lib/email/inbound-log';
import { inboundSecret, safeEqual } from '@/lib/email/inquiry-thread';

/**
 * נקודת הקליטה של תשובות צוות במייל (ראו lib/email/inbound.ts).
 *
 * נקראת רק מה-Email Worker של Cloudflare (cloudflare/email-worker), עם
 * הסוד המשותף בכותרת x-inbound-secret. הנתיב יושב מחוץ ל-matcher של
 * ה-proxy (api/) — אין session; האימות הוא הסוד + חתימת כתובת המענה
 * + בדיקה שהשולח איש צוות.
 *
 * קודי תשובה: 200 = טופל (או כפילות), 422 = נדחה במכוון, 5xx = כשל.
 * כל קוד שאינו 200 גורם ל-Worker להעביר את המייל המקורי לתיבת הגיבוי,
 * כך שתשובה של צוות לעולם אינה נעלמת בשקט.
 */

export const dynamic = 'force-dynamic';

// ‏Vercel מגביל גוף בקשה ל-4.5MB; מעל זה ה-Worker מעביר לגיבוי בלי לנסות.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const secret = inboundSecret();
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });

  const provided = request.headers.get('x-inbound-secret') ?? '';
  if (!safeEqual(provided, secret)) {
    // סוד שגוי הוא התקלה הנפוצה ביותר בהקמה — היא נרשמת ליומן האבחון,
    // אבל בהגבלת קצב: נקודה ציבורית אסור שתאפשר למלא את הטבלה.
    if (await allowRequest('inbound-unauthorized', 20, 3600)) {
      await logInboundAttempt({
        recipient: request.headers.get('x-envelope-to'),
        outcome: 'unauthorized',
        reason: 'x-inbound-secret אינו תואם ל-INBOUND_EMAIL_SECRET',
      });
    }
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!(await allowRequest('inbound-email', 120, 60))) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const recipient = request.headers.get('x-envelope-to') ?? '';
  const raw = await request.arrayBuffer();
  if (raw.byteLength === 0 || raw.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const trace: InboundTrace = {};
  try {
    const outcome = await processInboundReply(raw, recipient, trace);
    if (outcome.status === 'rejected' || outcome.status === 'failed') {
      console.warn('[inbound]', outcome.status, outcome.reason);
    }
    await logInboundAttempt({
      recipient,
      ...trace,
      outcome: outcome.status,
      reason: 'reason' in outcome ? outcome.reason : null,
      sizeBytes: raw.byteLength,
    });
    return NextResponse.json({ status: outcome.status }, { status: outcome.httpStatus });
  } catch (error) {
    console.error('[inbound] unexpected', error);
    await logInboundAttempt({
      recipient,
      ...trace,
      outcome: 'failed',
      reason: error instanceof Error ? `exception: ${error.message}` : 'exception',
      sizeBytes: raw.byteLength,
    });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
