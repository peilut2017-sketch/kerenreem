import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * לקוח service_role — עוקף RLS.
 *
 * כללי המשמעת (פרק 2.3 במסמך האב, עודכן לשיקוף המצב בפועל):
 *  • מיובא ממודולי src/lib/commerce/** וממודולי הניהול שדורשים עקיפת
 *    RLS מבוקרת (orders-actions, team-actions, coupons-actions,
 *    costs-actions, book-form-data, audit) — לעולם לא מרכיב UI ולא
 *    מנתיב ציבורי ישירות.
 *  • בכל נקודת שימוש כזו, בדיקת ההרשאה בקוד (assert…/require…) היא
 *    קו ההגנה היחיד — RLS לא יעצור דבר. לכן כל פונקציה שמשתמשת בו
 *    חייבת להתחיל בשער הרשאה, ואסור להוסיף שימוש חדש בלי כזה.
 *  • כל קריאה דרכו יושבת בפונקציית Domain עם שם מפורש, כך שהיקף
 *    העקיפה של RLS קריא ממקום אחד.
 *  • המפתח לעולם אינו נחשף עם קידומת NEXT_PUBLIC_.
 */
export function createServiceClient(): SupabaseClient | null {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) return null;

  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
