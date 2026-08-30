'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { getAdminSession } from './auth';

/** ראו ההסבר ליד ההגדרה המקבילה ב-api/auth/admin-callback/route.ts. */
const PW_RESET_COOKIE = 'kr-pw-reset';

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
  const ipOk = await allowRequest(ipBucket('admin-reset', headerList), 5, 3600);
  const emailOk = await allowRequest(`admin-reset-email:${trimmed}`, 3, 3600);
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

  // הגבלת קצב על אימות הסיסמה הנוכחית — בלעדיה זהו אורקל בדיקת סיסמאות
  // ללא חסימה עבור המשתמש המחובר (session חטוף היה מנחש בקצב חופשי).
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('admin-pw-change', headerList), 10, 3600))) {
    return { ok: false, error: 'יותר מדי ניסיונות. נסו שוב בעוד שעה.' };
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: session.email,
    password: input.currentPassword,
  });
  if (verifyError) return { ok: false, error: 'הסיסמה הנוכחית שגויה.' };

  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
    // הדגל שהוצב בהזמנת איש צוות (inviteStaffMember) — נמחק עם ההחלפה
    data: { must_change_password: false },
  });
  if (error) return { ok: false, error: error.message };

  // כמו בזרימת השחזור: סיסמה חדשה מנתקת כל session אחר של אותו משתמש.
  await supabase.auth.signOut({ scope: 'others' });
  return { ok: true };
}

/**
 * קביעת סיסמה חדשה אחרי לחיצה על קישור השחזור מהמייל.
 *
 * לא כל session מאומת מספיק כאן: בלי סימון ייעודי, הפעולה הזו הייתה
 * "אחות חלשה" של updateMyPassword — כל מי שהשיג session חי (עמדה
 * פתוחה, חטיפה) היה מחליף סיסמה בלי לדעת את הנוכחית. עוגיית
 * kr-pw-reset נקבעת רק ב-admin-callback (לחיצה על קישור השחזור
 * מהמייל), חיה 10 דקות, ונמחקת עם השימוש.
 */
export async function setPasswordAfterReset(newPassword: string): Promise<AdminAccountActionResult> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: 'קישור השחזור פג תוקף. יש לבקש קישור חדש.' };
  const cookieStore = await cookies();
  if (!cookieStore.get(PW_RESET_COOKIE)?.value) {
    return { ok: false, error: 'קישור השחזור פג תוקף. יש לבקש קישור חדש.' };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 8 תווים.' };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'החיבור למסד אינו מוגדר.' };

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });
  if (error) return { ok: false, error: error.message };

  cookieStore.delete(PW_RESET_COOKIE);
  // ניתוק כל שאר ה-sessions: החלפת סיסמה אחרי שחזור נועדה בדיוק למצב
  // שבו הגישה הישנה אינה אמינה — session ותיק (גם חטוף) לא שורד אותה.
  await supabase.auth.signOut({ scope: 'others' });
  return { ok: true };
}
