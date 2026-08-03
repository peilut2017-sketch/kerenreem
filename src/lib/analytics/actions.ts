'use server';

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from '@/lib/admin/auth';
import { ANALYTICS_RETENTION_MONTHS } from './constants';

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

export interface PurgeResult {
  status: 'idle' | 'done' | 'error';
  message?: string;
}

/**
 * מחיקת רשומות page_views ישנות מתקופת השמירה שהוצהרה במדיניות הפרטיות.
 * בלי כלי כזה ההצהרה על תקופת שמירה הייתה נכונה רק על הנייר: הנתונים
 * ממשיכים להצטבר לצמיתות בפועל. מנהל בלבד — page_views_admin_delete
 * ב-RLS חוסם כל תפקיד אחר גם אם קוד זה ישתבש, ואין הרצה אוטומטית: זו
 * פעולה שהצוות מפעיל ביודעין (ראו 18_page_views.sql).
 */
export async function purgeOldPageViews(): Promise<PurgeResult> {
  const session = await assertRole('admin');
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - ANALYTICS_RETENTION_MONTHS);

  const { error, count } = await supabase
    .from('page_views')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff.toISOString());

  if (error) return { status: 'error', message: `המחיקה נכשלה: ${error.message}` };

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'delete',
    table_name: 'page_views',
    record_id: null,
  });

  revalidatePath('/admin/analytics');
  return { status: 'done', message: `נמחקו ${count ?? 0} רשומות ישנות מ-${ANALYTICS_RETENTION_MONTHS} חודשים.` };
}
