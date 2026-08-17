'use server';

import { getAdminSession } from '@/lib/admin/auth';
import { writeAuditLog } from '@/lib/admin/audit';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.11] רישום פעילות שאינה "שמירת רשומה" ביומן הביקורת: כניסות למערכת
 * והעלאות קבצים. שתי הפעולות שקטות במכוון (מחזירות void ובולעות כשל) —
 * תיעוד שנכשל אינו סיבה לחסום התחברות או העלאה שכבר הצליחו.
 *
 * הזהות אינה מגיעה מהלקוח: הפעולה קוראת את ה-session בשרת, כך שאי אפשר
 * לרשום כניסה או העלאה בשם משתמש אחר.
 */

export async function recordAdminLogin(): Promise<void> {
  try {
    const session = await getAdminSession();
    if (!session) return;
    const supabase = await createClient();
    if (!supabase) return;
    await writeAuditLog(supabase, session.userId, 'login', 'auth', null, {
      context: `כניסה למערכת הניהול — ${session.email ?? session.profile.full_name ?? ''}`.trim(),
    });
  } catch (error) {
    console.error('[admin:auditLogin]', error);
  }
}

export async function recordAdminUpload(bucket: string, path: string): Promise<void> {
  try {
    const session = await getAdminSession();
    if (!session) return;
    const supabase = await createClient();
    if (!supabase) return;
    await writeAuditLog(supabase, session.userId, 'upload', 'storage', null, {
      context: `העלאת קובץ: ${bucket}/${path}`,
    });
  } catch (error) {
    console.error('[admin:auditUpload]', error);
  }
}
