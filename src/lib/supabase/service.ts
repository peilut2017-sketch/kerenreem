import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './config';

/**
 * לקוח service_role — עוקף RLS. לפעולות המסחר הכספיות בלבד:
 * יצירת הזמנה עם צילום, עיבוד Webhook, מלאי, מסמכים, הודעות.
 *
 * כללי המשמעת (פרק 2.3 במסמך האב):
 *  • מיובא אך ורק ממודולי src/lib/commerce/** — לעולם לא מרכיב UI,
 *    לא מ-actions כלליים ולא מנתיב ציבורי ישירות.
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
