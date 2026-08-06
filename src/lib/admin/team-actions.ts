'use server';

import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPlainEmail } from '@/lib/commerce/notifications';
import { ROLE_LABELS, ASSIGNABLE_ROLES } from './permissions';
import type { UserRole } from '@/lib/supabase/types';

/**
 * ניהול הצוות (פרק 19, מסך 15): הזמנת איש צוות במייל + סיסמה ראשונית,
 * שינוי תפקיד והסרת גישה. מנהל-על בלבד (הרשאת users). המשתמש נוצר עם
 * דגל kr_staff ב-app_metadata — הטריגר של migration 23 יוצר לו פרופיל
 * צוות; לקוחות חנות לעולם אינם מקבלים את הדגל.
 */

export interface TeamActionResult {
  ok: boolean;
  error?: string;
  /** הסיסמה הראשונית — מוצגת פעם אחת למנהל כשלא נשלח מייל */
  initialPassword?: string;
  emailSent?: boolean;
}

/** סיסמה ראשונית קריאה: 3 קבוצות של 4 — קלה להקראה בטלפון, קשה לניחוש. */
function generateInitialPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('');
  return `${group()}-${group()}-${group()}`;
}

export async function inviteStaffMember(input: {
  email: string;
  fullName: string;
  role: UserRole;
}): Promise<TeamActionResult> {
  const session = await assertPermission('users');
  if ('error' in session) return { ok: false, error: session.error };

  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'כתובת מייל לא תקינה' };
  }
  if (!ASSIGNABLE_ROLES.includes(input.role)) {
    return { ok: false, error: 'תפקיד לא מוכר' };
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד (SUPABASE_SERVICE_ROLE_KEY חסר)' };

  const password = generateInitialPassword();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { kr_staff: 'true' },
    user_metadata: { full_name: input.fullName.trim().slice(0, 120), must_change_password: true },
  });
  if (createError || !created.user) {
    const message = createError?.message ?? 'יצירת המשתמש נכשלה';
    return {
      ok: false,
      error: message.includes('already') ? 'קיים כבר משתמש עם המייל הזה' : message,
    };
  }

  // הטריגר יצר פרופיל (viewer); קיבוע התפקיד המבוקש. upsert — עמידות
  // גם אם הטריגר טרם רץ.
  const { error: profileError } = await service.from('profiles').upsert(
    {
      id: created.user.id,
      full_name: input.fullName.trim().slice(0, 120) || null,
      role: input.role,
    },
    { onConflict: 'id' },
  );
  if (profileError) {
    console.error('[admin:team] profile', profileError.message);
    return { ok: false, error: `המשתמש נוצר אך קיבוע התפקיד נכשל: ${profileError.message}` };
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'staff_invited',
      table_name: 'profiles',
      record_id: created.user.id,
      new_values: { email, role: input.role },
      context: 'הזמנת איש צוות',
    });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const emailResult = await sendPlainEmail(
    email,
    'הוזמנת לצוות מכון קרן רא״ם',
    `<h2 style="margin:0 0 12px">שלום ${input.fullName || ''},</h2>
     <p>נוצר עבורך חשבון צוות באתר מכון קרן רא״ם בתפקיד <strong>${ROLE_LABELS[input.role]}</strong>.</p>
     <p>פרטי הכניסה הראשונית:</p>
     <p style="background:#f6f1e7;border-radius:8px;padding:12px 16px;direction:ltr;text-align:left">
       <strong>${email}</strong><br/>
       <strong style="font-family:monospace">${password}</strong>
     </p>
     <p>בכניסה הראשונה יש להחליף את הסיסמה (התחברות → ${siteUrl}/admin/login).</p>
     <p style="color:#8a8577;font-size:13px">אם לא ציפית להזמנה הזו — אפשר להתעלם ממנה.</p>`,
  );

  revalidatePath('/admin/team');
  return {
    ok: true,
    emailSent: emailResult.ok,
    // בלי ספק מייל מוגדר — הסיסמה מוצגת פעם אחת למנהל למסירה ידנית
    initialPassword: emailResult.ok ? undefined : password,
  };
}

/** הסרת גישת צוות: מחיקת הפרופיל + הדגל. המשתמש נשאר ב-auth (ללקוחות). */
export async function revokeStaffAccess(userId: string): Promise<TeamActionResult> {
  const session = await assertPermission('users');
  if ('error' in session) return { ok: false, error: session.error };
  if (session.userId === userId) return { ok: false, error: 'לא ניתן להסיר את עצמך' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { error } = await service.from('profiles').delete().eq('id', userId);
  if (error) return { ok: false, error: error.message };
  await service.auth.admin.updateUserById(userId, { app_metadata: { kr_staff: null } });

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'staff_revoked',
      table_name: 'profiles',
      record_id: userId,
      context: 'הסרת גישת צוות',
    });
  }
  revalidatePath('/admin/team');
  return { ok: true };
}
