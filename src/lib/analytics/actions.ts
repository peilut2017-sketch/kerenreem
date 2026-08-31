'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { clientIp, dailyVisitorHash } from './shared';

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

    const headerList = await headers();
    // הגבלת קצב נדיבה — חוסמת הצפה של page_views מסקריפט בלולאה בלי
    // לפגוע בגלישה אמיתית. fail-open, כמו שאר המגבלות.
    if (!(await allowRequest(ipBucket('page-view', headerList), 240, 60))) return;

    const supabase = await createClient();
    if (!supabase) return;

    const ip = clientIp(headerList);
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
