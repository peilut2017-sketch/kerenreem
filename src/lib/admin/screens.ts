import type { UserRole } from '@/lib/supabase/types';

/**
 * [1.7] רישום מסכי הניהול — מקור יחיד לשלוש שכבות: ברירת המחדל לפי role,
 * ה-checklist בטופס "הרשאה מותאמת אישית" בצוות, וה-gate בכל page.tsx
 * (requireScreenPermission). לא תלוי שרת בכוונה — אותו קובץ משמש גם צד
 * לקוח (AdminNav) וגם צד שרת (auth.ts), כמו permissions.ts הקיים.
 *
 * מסך = יחידת הרשאה עצמאית. חלוקה לפי URL הייתה מטעה: /admin/books/sale-prices
 * ו-/admin/books/settings חיים תחת "books/" אך הם מסכי חנות/כספים לגמרי,
 * לא תוכן — ולכן ה-key כאן לא תמיד תואם את תיקיית ה-route.
 */
export type ScreenKey =
  // תוכן
  | 'books'
  | 'authors'
  | 'categories'
  | 'series'
  | 'tags'
  | 'homepage-shelf'
  | 'books-readiness'
  | 'banners'
  | 'events'
  | 'activities'
  | 'pages'
  | 'contact-topics'
  | 'contact-fields'
  | 'messages'
  | 'analytics'
  // חנות
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'shipping'
  | 'coupons'
  | 'sale-prices'
  | 'reports'
  | 'reports-inventory-moves'
  | 'reports-profitability'
  | 'store-settings'
  // מנהל־על בלבד — לא ניתן ל-override (ראו ADMIN_ONLY_SCREENS למטה)
  | 'team'
  | 'org-settings'
  | 'audit-log'
  | 'diagnostics';

export interface ScreenDef {
  key: ScreenKey;
  label: string;
  family: 'content' | 'store' | 'system';
}

export const SCREENS: readonly ScreenDef[] = [
  { key: 'books', label: 'ספרים', family: 'content' },
  { key: 'authors', label: 'מחברים', family: 'content' },
  { key: 'categories', label: 'קטגוריות', family: 'content' },
  { key: 'series', label: 'סדרות', family: 'content' },
  { key: 'tags', label: 'תגיות', family: 'content' },
  { key: 'homepage-shelf', label: 'מדף הספרים בעמוד הבית', family: 'content' },
  { key: 'books-readiness', label: 'ספרים שלא מוכנים לחנות', family: 'content' },
  { key: 'banners', label: 'באנרים', family: 'content' },
  { key: 'events', label: 'אירועים', family: 'content' },
  { key: 'activities', label: 'צירי פעילות', family: 'content' },
  { key: 'pages', label: 'עמודי תוכן', family: 'content' },
  { key: 'contact-topics', label: 'תחומי פנייה', family: 'content' },
  { key: 'contact-fields', label: 'שדות מותאמים', family: 'content' },
  { key: 'messages', label: 'פניות שהתקבלו', family: 'content' },
  { key: 'analytics', label: 'אנליטיקס', family: 'content' },
  { key: 'orders', label: 'הזמנות', family: 'store' },
  { key: 'customers', label: 'לקוחות', family: 'store' },
  { key: 'inventory', label: 'מלאי ומחסנים', family: 'store' },
  { key: 'shipping', label: 'שיטות אספקה ואזורי משלוח', family: 'store' },
  { key: 'coupons', label: 'קופונים', family: 'store' },
  { key: 'sale-prices', label: 'מחירי מבצע', family: 'store' },
  { key: 'reports', label: 'דוחות', family: 'store' },
  { key: 'reports-inventory-moves', label: 'היסטוריית תנועות מלאי', family: 'store' },
  { key: 'reports-profitability', label: 'דוח רווחיות ועלויות', family: 'store' },
  { key: 'store-settings', label: 'הגדרות קטלוג וחנות', family: 'store' },
  { key: 'team', label: 'צוות והרשאות', family: 'system' },
  { key: 'org-settings', label: 'הגדרות ארגון', family: 'system' },
  { key: 'audit-log', label: 'יומן ביקורת', family: 'system' },
  { key: 'diagnostics', label: 'אבחון', family: 'system' },
] as const;

/**
 * שלושת המסכים האלה נשארים admin-בלבד תמיד, בלי אפשרות override — ניהול
 * צוות (הזמנת/הדחת אנשי צוות ושינוי תפקידים) לא ניתן להאציל בכוונה, ויומן
 * הביקורת/האבחון עוקבים גם אחרי admin עצמו ונשארים ברגישות הקיימת שלהם היום
 * (requireRole('admin')). "הגדרות ארגון" (org-settings) *לא* ברשימה הזו —
 * בעל האתר הגדיר מפורשות שמנהל ראשי מקבל "גישה לכל ההגדרות, לא כולל הוספת
 * משתמשים", וזהות הארגון היא הגדרה, לא ניהול צוות.
 */
export const ADMIN_ONLY_SCREENS = new Set<ScreenKey>(['team', 'audit-log', 'diagnostics']);

const CONTENT_SCREENS = SCREENS.filter((s) => s.family === 'content').map((s) => s.key);
const STORE_SCREENS = SCREENS.filter((s) => s.family === 'store').map((s) => s.key);

/**
 * מוכרן/מלקט: אותו היקף בדיוק כמו permissions.ts הקיים (store/store_view) —
 * לא הורחב ולא צומצם בפרויקט הזה, רק סווג מחדש כתת-דרגות של "ניהול חנות".
 * costs/reports-profitability נשארים admin+manager בלבד כברירת מחדל בכל
 * התפקידים האחרים (כולל store_manager) — ניתן להעניק ב-override פרטני.
 */
const SELLER_SCREENS: readonly ScreenKey[] = [
  'orders',
  'customers',
  'inventory',
  'sale-prices',
  'reports-inventory-moves',
];
const PICKER_SCREENS: readonly ScreenKey[] = ['orders', 'inventory', 'reports-inventory-moves'];

export interface ScreenAccess {
  view: boolean;
  edit: boolean;
}

/** ברירת המחדל של role לכל מסך — לפני שנבדק override פר-משתמש. */
export function defaultScreenAccess(role: UserRole, screen: ScreenKey): ScreenAccess {
  if (role === 'admin') return { view: true, edit: true };
  if (ADMIN_ONLY_SCREENS.has(screen)) return { view: false, edit: false };

  if (role === 'manager') return { view: true, edit: true };

  if (role === 'editor') {
    const inFamily = CONTENT_SCREENS.includes(screen);
    return { view: inFamily, edit: inFamily };
  }

  if (role === 'store_manager') {
    const inFamily = STORE_SCREENS.includes(screen);
    return { view: inFamily, edit: inFamily };
  }

  if (role === 'seller') {
    const inScope = SELLER_SCREENS.includes(screen);
    return { view: inScope, edit: inScope };
  }

  if (role === 'picker') {
    const inScope = PICKER_SCREENS.includes(screen);
    return { view: inScope, edit: false };
  }

  return { view: false, edit: false };
}
