import type { UserRole } from '@/lib/supabase/types';

/**
 * מודל ההרשאות של חמשת התפקידים (פרק 19 במסמך האב) — טהור, בלי תלות
 * שרת, כדי שגם הניווט בצד הלקוח וגם השערים בצד השרת יקראו מאותה מפה.
 * ההרשאה הדו-ממדית (תוכן ↔ חנות) אינה ניתנת לביטוי בדירוג ליניארי:
 * מוכרן רואה חנות בלי תוכן, עורך תוכן רואה תוכן בלי חנות.
 */

export type AdminPermission =
  /** כתיבת תוכן — ספרים, מחברים, עמודים, אירועים */
  | 'content'
  /** תפעול חנות — הזמנות, מלאי, הזמנה ידנית, מיילים ללקוח */
  | 'store'
  /** צפייה תפעולית בהזמנות ובמלאי + סטטוס אספקה (מלקט ומעלה) */
  | 'store_view'
  /** כספים והגדרות חנות — זיכוי, תשלום חיצוני, קופונים, משלוחים, דגלים */
  | 'finance'
  /** עלויות ורווחיות — נסתר מכל מי שאינו מנהל */
  | 'costs'
  /** ניהול צוות — הזמנה, תפקידים, השבתה (מנהל-על בלבד) */
  | 'users';

/**
 * [1.7] נשמר כמו שהוא לתאימות אחורה — עדיין בשימוש בקוד קיים רב מדי כדי
 * להחליף בבת אחת (requirePermission/hasPermission). מוחלף בהדרגה, מסך-מסך,
 * ב-requireScreenPermission (screens.ts + auth.ts). store_manager מקבל כאן
 * את אותה תמונה בדיוק כמו manager פחות costs/users — לשם עקביות בלבד; ברגע
 * שמסך מסוים עבר ל-requireScreenPermission, הערך כאן כבר לא קובע לגביו.
 */
const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AdminPermission>> = {
  admin: new Set(['content', 'store', 'store_view', 'finance', 'costs', 'users']),
  manager: new Set(['content', 'store', 'store_view', 'finance', 'costs']),
  editor: new Set(['content']),
  store_manager: new Set(['store', 'store_view', 'finance']),
  seller: new Set(['store', 'store_view']),
  picker: new Set(['store_view']),
  viewer: new Set([]),
};

export function hasPermission(role: UserRole, permission: AdminPermission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** תוויות התפקידים בעברית — מקור יחיד למסכי הצוות ולבחירת תפקיד. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'מנהל־על',
  manager: 'מנהל ראשי',
  editor: 'ניהול תוכן',
  store_manager: 'ניהול חנות',
  seller: 'ניהול חנות · מוכרן',
  picker: 'ניהול חנות · מלקט',
  viewer: 'צפייה בלבד',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'גישה מלאה לכל המערכת, כולל ניהול הצוות',
  manager: 'כל ההגדרות, לא כולל הוספת משתמשים',
  editor: 'ניהול תוכן — ספרים, מחברים, קטגוריות, סדרות, תגיות ושאר עמודי האתר; ללא גישה לחנות',
  store_manager: 'כל מערכת החנות — הזמנות, מלאי, משלוחים, קופונים, מחירי מבצע ודוחות; ללא תוכן',
  seller: 'תת-דרגה בתוך ניהול חנות — הזמנות, מלאי והזמנות ידניות; ללא כספים/דוחות',
  picker: 'תת-דרגה בתוך ניהול חנות — ליקוט בלבד, צפייה בהזמנות ששולמו ועדכון סטטוס אספקה',
  viewer: 'צפייה בתוכן בלבד (תפקיד היסטורי)',
};

/** התפקידים המוצעים בהוספת איש צוות — לפי סדר היקף ההרשאה. */
export const ASSIGNABLE_ROLES: UserRole[] = [
  'admin',
  'manager',
  'editor',
  'store_manager',
  'seller',
  'picker',
];
