import { NextResponse } from 'next/server';
import { processMorningWebhook } from '@/lib/commerce/webhook-processing';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';

/**
 * נקודת הקליטה של התראות מורנינג (תרשים 8).
 *
 * הנתיב יושב מחוץ ל-matcher של ה-proxy (proxy.ts מחריג api) — אין כאן
 * session ואין עוגיות; האימות עצמאי לחלוטין: חתימת HMAC על הגוף הגולמי
 * (בתוך processMorningWebhook), אימות סכום מול צילום ההזמנה, ו-rate
 * limit גס נגד הצפה. תשובות מהירות: מורנינג מקבלת 200 גם על אירוע
 * שלא שויך — הוא נשמר לחקירה; 401 רק על חתימה שגויה.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const allowed = await allowRequest(ipBucket('webhook-morning', request.headers), 120, 60);
  if (!allowed) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > 256_000) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const outcome = await processMorningWebhook(rawBody, request.headers);
  return NextResponse.json({ status: outcome.status }, { status: outcome.httpStatus });
}
