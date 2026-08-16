'use server';

import { getAdminSession } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * שמירת העדפת תצוגה אישית (למשל בחירת עמודות בטבלת הספרים).
 *
 * ההעדפה נשמרת פר-משתמש בטבלת admin_user_prefs ולא ב-localStorage,
 * כדי שהבחירה תלווה את המשתמש בכל דפדפן ומחשב. הפעולה שקטה במתכוון:
 * כישלון שמירת העדפה אינו סיבה להפריע לעבודה — התצוגה כבר התעדכנה
 * בצד הלקוח, ובביקור הבא פשוט תיטען ברירת המחדל.
 */
export async function saveUserPref(key: string, value: unknown): Promise<void> {
  const session = await getAdminSession();
  if (!session) return;
  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.from('admin_user_prefs').upsert({
    user_id: session.userId,
    key,
    value,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('שמירת העדפת משתמש נכשלה:', error.message);
}
