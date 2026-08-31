import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  pollPendingPayments,
  purgeOldWebhookPayloads,
  releaseExpiredReservations,
} from '@/lib/commerce/webhook-processing';
import { reconcileRecentPayments } from '@/lib/commerce/reconciliation';
import {
  autoCloseCompletedOrders,
  expireStalePendingOrders,
  notifyBackInStock,
  purgeAbandonedSessions,
  purgeOldAnalytics,
  purgeStaleRateLimits,
} from '@/lib/commerce/maintenance';

/**
 * משימות הרקע של המסחר, בקריאה אחת (Vercel Cron / מתזמן חיצוני):
 *   1. Polling יזום על תשלומים תלויים — גיבוי ל-Webhook שלא הגיע.
 *   2. שחרור שמירות מלאי של דפי תשלום שפגו.
 *   3. [1.1] התאמה יומית מול מורנינג (שער G3) — פערים מתויגים לצוות.
 *   4. [1.1] טיהור payload גולמי של Webhooks בני 90 יום (פרק 8.6).
 *   5. טיהור דליי rate_limits ישנים — הפונקציה במסד מוחקת רק את הדלי
 *      הנוכחי, וכל IP ייחודי משאיר שורות לנצח בלי הטיהור הזה.
 *
 * מוגן בסוד סטטי (CRON_SECRET) — הנתיב מחוץ ל-proxy ולכן בלי session.
 * כל פעולה פנימית idempotent-ית, כך שריצה כפולה אינה מזיקה.
 *
 * ⚠ התזמון ב-vercel.json הוא יומי (מגבלת תוכנית Hobby) — בעוד ש-polling
 * התשלומים ושחרור השמירות נכתבו לקצב של ~10 דקות. עם המעבר לתוכנית
 * שמאפשרת זאת, יש לקצר את התזמון (ראו commerce-gap-analysis).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** השוואה קבועת-זמן — כמו guestTokenMatches ואימות חתימת ה-Webhook. */
function secretMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // allSettled ולא all: תקלה במשימה אחת (מורנינג איטית, טבלה נעולה)
  // אינה מפילה את כל שאר משימות התחזוקה של אותה ריצה.
  const results = await Promise.allSettled([
    pollPendingPayments(10),
    releaseExpiredReservations(),
    reconcileRecentPayments(3),
    purgeOldWebhookPayloads(90),
    expireStalePendingOrders(7),
    autoCloseCompletedOrders(30),
    purgeAbandonedSessions(),
    notifyBackInStock(),
    purgeStaleRateLimits(),
    purgeOldAnalytics(),
  ]);

  const keys = [
    'polled',
    'released',
    'reconciliation',
    'purged',
    'expired',
    'closed',
    'sessionsPurged',
    'backInStock',
    'rateLimitsPurged',
    'analyticsPurged',
  ] as const;
  const report: Record<string, unknown> = {};
  results.forEach((result, index) => {
    report[keys[index]] =
      result.status === 'fulfilled'
        ? result.value
        : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
  });

  // אם משימה כלשהי נכשלה — סטטוס לא-2xx. אחרת המתזמן (Vercel Cron) מתריע
  // רק על תגובות שגיאה, וכשל שחוזר בכל ריצה (poll זורק, purge על טבלה
  // נעולה) נשאר "ירוק" לנצח בעוד שאינו עושה דבר. שורת log מובנית אחת כדי
  // ש-log-drain יוכל להתריע גם בלי לפרש את גוף התשובה.
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? keys[i] : null))
    .filter((k): k is (typeof keys)[number] => k !== null);
  if (failed.length > 0) {
    console.error('[cron:commerce] tasks failed:', failed.join(', '));
    return NextResponse.json({ ...report, failed }, { status: 500 });
  }

  return NextResponse.json(report);
}
