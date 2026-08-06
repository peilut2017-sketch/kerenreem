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

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<AdminPermission>> = {
  admin: new Set(['content', 'store', 'store_view', 'finance', 'costs', 'users']),
  manager: new Set(['content', 'store', 'store_view', 'finance', 'costs']),
  editor: new Set(['content']),
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
  manager: 'מנהל',
  editor: 'עורך תוכן',
  seller: 'מוכרן',
  picker: 'מלקט',
  viewer: 'צפייה בלבד',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'גישה מלאה לכל המערכת, כולל ניהול הצוות',
  manager: 'כל המערכת מלבד ניהול משתמשים',
  editor: 'תוכן בלבד — ללא צפייה או עריכה במערכת החנות',
  seller: 'מערכת החנות — הזמנות, מלאי והזמנות ידניות; ללא תוכן',
  picker: 'ליקוט בלבד — צפייה בהזמנות ששולמו ועדכון סטטוס אספקה',
  viewer: 'צפייה בתוכן בלבד (תפקיד היסטורי)',
};

/** התפקידים המוצעים בהוספת איש צוות — לפי סדר היקף ההרשאה. */
export const ASSIGNABLE_ROLES: UserRole[] = ['admin', 'manager', 'editor', 'seller', 'picker'];
