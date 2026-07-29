/**
 * זיהוי האם Supabase מוגדר בסביבה הנוכחית.
 *
 * האתר חייב להיבנות ולרוץ גם בלי חיבור למסד — למשל בבנייה ראשונית,
 * ב-CI, או במחשב של מפתח חדש. כשאין הגדרה, שכבת הנתונים מחזירה תוצאות
 * ריקות במקום לזרוק שגיאה, והממשק מציג מצבי ריק.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
