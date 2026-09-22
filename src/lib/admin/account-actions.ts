'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { sendEmail } from '@/lib/email/send';
import { passwordChangedEmail, passwordResetEmail } from '@/lib/email/templates';
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
  const redirectTo = `${siteUrl}/api/auth/admin-callback`;

  /*
   * [1.40] ההודעה נשלחת מהאתר, בעיצוב האתר — לא בתבנית ברירת המחדל
   * של Supabase.
   *
   * generateLink מייצר את אותו קישור שחזור בדיוק ש-resetPasswordForEmail
   * היה שולח, אבל *מחזיר* אותו במקום לשלוח: כך הוא נכנס לתבנית המותגת
   * (templates.ts) ויוצא דרך אותו ספק כמו שאר הדואר של האתר. התבנית
   * של Supabase היא אנגלית, בלי לוגו ובלי RTL, ומי שקיבל אותה לא היה
   * בטוח שהיא מאיתנו.
   *
   * generateLink דורש מפתח service_role. בלי מפתח כזה חוזרים למסלול
   * הישן — עדיף מייל גנרי מאשר שום מייל.
   */
  const service = createServiceClient();
  if (service) {
    const { data, error } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: trimmed,
      options: { redirectTo },
    });

    // כתובת שאינה רשומה מחזירה שגיאה. היא נרשמת ליומן ולא למשתמש —
    // ההודעה אליו זהה בכל מקרה, כדי לא לחשוף מי רשום במערכת.
    if (error || !data?.properties?.action_link) {
      if (error) console.error('[admin:account] generateLink', error.message);
      return { ok: true };
    }

    const email = await passwordResetEmail({
      resetUrl: data.properties.action_link,
      name: (data.user?.user_metadata?.full_name as string | undefined) ?? null,
      isStaff: true,
    });
    const sent = await sendEmail(trimmed, email);
    if (!sent.ok && !sent.skipped) {
      console.error('[admin:account] reset email', sent.error);
    }
    // skipped = אין ספק דואר מוגדר. זו תקלת הגדרה אמיתית שחוסמת את
    // איפוס הסיסמה לגמרי, ולכן כאן דווקא כן אומרים אותה — אין בה שום
    // מידע על מי רשום במערכת.
    if (sent.skipped) {
      return { ok: false, error: 'שירות הדואר אינו מוגדר באתר — פנו למנהל המערכת.' };
    }
    return { ok: true };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, { redirectTo });
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

/**
 * [1.40] התראה על החלפת סיסמה — ההודעה שמאפשרת לבעל החשבון לזהות
 * השתלטות. נשלחת אחרי שהשינוי כבר הצליח, ולכן כשל בשליחתה אינו
 * מבטל אותו: מוחזר ok, והכשל נרשם ליומן בלבד.
 */
async function notifyPasswordChanged(email: string, name: string | null): Promise<void> {
  const whenLabel = new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date());

  const message = await passwordChangedEmail({ name, whenLabel, isStaff: true });
  const sent = await sendEmail(email, message);
  if (!sent.ok && !sent.skipped) console.error('[admin:account] password-changed email', sent.error);
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
  await notifyPasswordChanged(session.email, session.profile.full_name ?? null);
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
  if (session.email) {
    await notifyPasswordChanged(session.email, session.profile.full_name ?? null);
  }
  return { ok: true };
}
