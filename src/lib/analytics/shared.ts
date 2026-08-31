import 'server-only';
import { createHash } from 'node:crypto';

/**
 * עזרי אנליטיקה משותפים ל-page_views ול-commerce_events.
 *
 * לפני האיחוד, dailyVisitorHash הוגדר פעמיים בדיוק (analytics/actions.ts
 * ו-commerce/events-actions.ts) עם אותו מלח ואותו פורמט — סיכון שקט:
 * שינוי המלח/הפורמט במקום אחד היה מפצל את מרחב ה"מבקר הייחודי" בין שני
 * הדוחות ושובר את הדה-דופ הצולב. מקור אחד מונע זאת.
 */

/** גיבוב מבקר יומי — לא ה-IP עצמו. מתחלף בכל יום קלנדרי (ראו 18_page_views.sql). */
export function dailyVisitorHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? 'keren-raam-page-views';
  return createHash('sha256').update(`${today}:${ip}:${userAgent}:${salt}`).digest('hex');
}

/** ה-IP מכותרות ה-proxy — לספירה בלבד, לא להרשאה (x-forwarded-for נשלט בלקוח). */
export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/** מזהה UUID תקין — לסינון book_id/order_id שמגיעים מהלקוח לפני כתיבה. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
