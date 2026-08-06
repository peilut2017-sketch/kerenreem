import { NextResponse } from 'next/server';
import {
  pollPendingPayments,
  purgeOldWebhookPayloads,
  releaseExpiredReservations,
} from '@/lib/commerce/webhook-processing';
import { reconcileRecentPayments } from '@/lib/commerce/reconciliation';

/**
 * משימות הרקע של המסחר, בקריאה אחת (Vercel Cron / מתזמן חיצוני):
 *   1. Polling יזום על תשלומים תלויים — גיבוי ל-Webhook שלא הגיע.
 *   2. שחרור שמירות מלאי של דפי תשלום שפגו.
 *   3. [1.1] התאמה יומית מול מורנינג (שער G3) — פערים מתויגים לצוות.
 *   4. [1.1] טיהור payload גולמי של Webhooks בני 90 יום (פרק 8.6).
 *
 * מוגן בסוד סטטי (CRON_SECRET) — הנתיב מחוץ ל-proxy ולכן בלי session.
 * כל פעולה פנימית idempotent-ית, כך שריצה כפולה אינה מזיקה.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get('authorization')?.replace('Bearer ', '') ?? '';
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [polled, released, reconciliation, purged] = await Promise.all([
    pollPendingPayments(10),
    releaseExpiredReservations(),
    reconcileRecentPayments(3),
    purgeOldWebhookPayloads(90),
  ]);

  return NextResponse.json({ polled, released, reconciliation, purged });
}
