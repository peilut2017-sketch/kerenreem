import type { EmailRole } from './addresses';

/**
 * [1.40] רשימת תבניות הדואר — מודול נטול תלויות שרת בכוונה.
 *
 * התבניות עצמן (templates.ts) מסומנות 'server-only': הן קוראות את
 * הגדרות האתר ואת פרטי הקשר מהמסד. רכיב הלקוח של מסך "דואר יוצא"
 * צריך רק את *השמות* כדי לבנות את בורר התבניות — ייבוא מהמודול
 * ההוא היה גורר את כל שכבת השרת אל חבילת הדפדפן והבנייה נכשלת.
 * לכן הרשימה חיה כאן, ושני הצדדים קוראים ממנה.
 *
 * ‏addresses.ts כן מסומן server-only, ולכן הטיפוס EmailRole מיובא כאן
 * ב-import type: ייבוא טיפוס נמחק בקומפילציה ואינו יוצר תלות ריצה.
 *
 * ‏[1.41] לכל תבנית נרשמים כאן התפקיד וכתובת המענה שלה. זה מה שמאפשר
 * לשליחת הבדיקה במסך הניהול לצאת **באותה תצורה בדיוק** כמו בייצור —
 * בדיקה שיוצאת מכתובת אחרת מזו שהלקוח יראה אינה בדיקה.
 */

/** לאן מפנה ה-Reply-To של התבנית. */
export type TemplateReplyTo =
  /** ‏contact@ — תיבה שמישהו קורא. */
  | 'contact'
  /** בלי Reply-To, ובמפורש (איפוס סיסמה). */
  | 'none'
  /** כתובת הפונה — התראת פנייה חדשה לצוות. */
  | 'sender';

export const SITE_EMAIL_TEMPLATES = [
  { id: 'password_reset', label: 'איפוס סיסמה', role: 'automated', replyTo: 'none' },
  { id: 'password_changed', label: 'הסיסמה הוחלפה', role: 'automated', replyTo: 'contact' },
  { id: 'contact_ack', label: 'אישור קבלת פנייה (לפונה)', role: 'automated', replyTo: 'contact' },
  { id: 'contact_staff', label: 'התראה על פנייה חדשה (לצוות)', role: 'automated', replyTo: 'sender' },
  { id: 'contact_reply', label: 'מענה לפנייה', role: 'human', replyTo: 'contact' },
  { id: 'team_invite', label: 'הזמנת איש צוות', role: 'automated', replyTo: 'contact' },
] as const satisfies readonly {
  id: string;
  label: string;
  role: EmailRole;
  replyTo: TemplateReplyTo;
}[];

export type SiteEmailTemplate = (typeof SITE_EMAIL_TEMPLATES)[number]['id'];

/** התצורה של תבנית אחת, לפי מזהה. */
export function templateDelivery(
  id: SiteEmailTemplate,
): { role: EmailRole; replyTo: TemplateReplyTo } {
  const found = SITE_EMAIL_TEMPLATES.find((template) => template.id === id);
  // ברירת המחדל השמרנית: אוטומטי ובלי Reply-To. תבנית חדשה שנשכחה
  // ברשימה לא תתחיל לשלוח הזמנות לענות מעצמה.
  return found ? { role: found.role, replyTo: found.replyTo } : { role: 'automated', replyTo: 'none' };
}
