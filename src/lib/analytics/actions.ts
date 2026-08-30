'use server';

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

/**
 * גיבוב יומי של IP + User-Agent — לא ה-IP עצמו, ולא נשמר בשום מקום.
 * מתחלף בכל יום קלנדרי, כך שאפשר לספור "מבקרים ייחודיים" בטווח זמן בלי
 * לשמור זיהוי בר-מעקב לאורך זמן. ראו את ההסבר המלא ב-18_page_views.sql.
 */
function dailyVisitorHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? 'keren-raam-page-views';
  return createHash('sha256').update(`${today}:${ip}:${userAgent}:${salt}`).digest('hex');
}

/** רק שם המתחם של המפנה — לא הכתובת המלאה, שעלולה לכלול פרמטרים עם מידע מזהה. */
function referrerHostname(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname || null;
  } catch {
    return null;
  }
}

/**
 * נקרא פעם אחת מ-<AnalyticsBeacon> בכל טעינת עמוד ציבורי, כולל ניווט
 * בצד הלקוח — ראו שם.
 *
 * best-effort במכוון: כשל בתיעוד ביקור לא אמור להפיל שום דבר במסך של
 * המבקר, ולכן אין החזרת שגיאה — רק רישום ליומן.
 */
export async function recordPageView(path: string, locale: string, referrer: string | null): Promise<void> {
  try {
    // הפרמטרים מגיעים מהדפדפן — Server Action ציבורי אפשר לקרוא ישירות
    // עם כל payload. גבולות צורה בסיסיים כדי שלא ניתן יהיה להזרים זבל
    // שרירותי למסך האנליטיקס או לנפח את הטבלה במחרוזות ענק.
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 300) return;
    if (locale !== 'he' && locale !== 'en') return;

    const supabase = await createClient();
    if (!supabase) return;

    const headerList = await headers();
    const ip =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerList.get('x-real-ip') ||
      'unknown';
    const userAgent = headerList.get('user-agent') ?? 'unknown';

    const { error } = await supabase.from('page_views').insert({
      path,
      locale,
      referrer_host: referrerHostname(referrer),
      visitor_hash: dailyVisitorHash(ip, userAgent),
    });

    if (error) console.error('[analytics:recordPageView]', error.code, error.message);
  } catch (error) {
    console.error('[analytics:recordPageView] חריגה לא צפויה', error);
  }
}
