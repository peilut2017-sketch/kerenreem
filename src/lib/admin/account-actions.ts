'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { getAdminSession } from './auth';

/**
 * [1.8] ניהול חשבון עצמי לאיש צוות — לא לבלבל עם team-actions.ts, שמנהל
 * אנשי צוות *אחרים* ודורש הרשאת users. הפעולות כאן פועלות תמיד על
 * המשתמש המחובר בלבד, ולכן אינן מקבלות userId כפרמטר.
 */

export interface AdminAccountActionResult {
  ok: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * בקשת קישור איפוס סיסמה למייל, ממסך הכניסה (לפני התחברות). ההודעה
 * ללקוח זהה בהצלחה ובכישלון-שקט (מייל לא רשום) — כדי לא לחשוף אילו
 * כתובות קיימות במערכת. כישלון תשתית אמיתי (למשל: אין חיבור למסד) כן
 * חוזר כשגיאה מפורשת, כי אין בו חשיפת מידע.
 */
export async function requestAdminPasswordReset(email: string): Promise<AdminAccountActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { ok: false, error: 'כתובת מייל לא תקינה' };

  const headerList = await headers();
  // fail-closed: איפוס סיסמת מנהל — עדיף לחסום זמנית מאשר לפתוח
  // brute-force כשמנגנון ההגבלה עצמו נכשל.
  const ipOk = await allowRequest(ipBucket('admin-reset', headerList), 5, 3600, { failClosed: true });
  const emailOk = await allowRequest(`admin-reset-email:${trimmed}`, 3, 3600, { failClosed: true });
  if (!ipOk || !emailOk) return { ok: false, error: 'יותר מדי בקשות. נסו שוב בעוד שעה.' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'החיבור למסד אינו מוגדר.' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo: `${siteUrl}/api/auth/admin-callback`,
  });
  if (error) console.error('[admin:account] reset request', error.message);

  return { ok: true };
}

/** שינוי כתובת המייל של המשתמש המחובר — Supabase שולח קישור אישור לכתובת החדשה. */
export async function updateMyEmail(email: string): Promise<AdminAccountActionResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: 'יש להתחבר מחדש.' };

  const trimmed = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return { ok: false, error: 'כתובת מייל לא תקינה' };
  if (trimmed === session.email?.toLowerCase()) {
    return { ok: false, error: 'זו כבר כתובת המייל הנוכחית.' };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'החיבור למסד אינו מוגדר.' };

  const { error } = await supabase.auth.updateUser({ email: trimmed });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** שינוי סיסמה בעודו מחובר — מאמת את הסיסמה הנוכחית לפני ההחלפה. */
export async function updateMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AdminAccountActionResult> {
  const session = await getAdminSession();
  if (!session?.email) return { ok: false, error: 'יש להתחבר מחדש.' };
  if (input.newPassword.length < 8) {
    return { ok: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים.' };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'החיבור למסד אינו מוגדר.' };

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: input.currentPassword,
  });
  if (verifyError) return { ok: false, error: 'הסיסמה הנוכחית שגויה.' };

  const { error } = await supabase.auth.updateUser({ password: input.newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * קביעת סיסמה חדשה אחרי לחיצה על קישור השחזור מהמייל: ה-session הזמני
 * שנוצר ב-/api/auth/admin-callback הוא ההוכחה לזהות — אין צורך (ואי אפשר
 * לדעת) בסיסמה נוכחית, בניגוד ל-updateMyPassword.
 */
export async function setPasswordAfterReset(newPassword: string): Promise<AdminAccountActionResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: 'קישור השחזור פג תוקף. יש לבקש קישור חדש.' };
  if (newPassword.length < 8) {
    return { ok: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים.' };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'החיבור למסד אינו מוגדר.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
