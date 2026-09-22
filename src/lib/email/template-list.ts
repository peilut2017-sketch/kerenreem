/**
 * [1.40] רשימת תבניות הדואר — מודול נטול תלויות שרת בכוונה.
 *
 * התבניות עצמן (templates.ts) מסומנות 'server-only': הן קוראות את
 * הגדרות האתר ואת פרטי הקשר מהמסד. רכיב הלקוח של מסך "דואר יוצא"
 * צריך רק את *השמות* כדי לבנות את בורר התבניות — ייבוא מהמודול
 * ההוא היה גורר את כל שכבת השרת אל חבילת הדפדפן והבנייה נכשלת.
 * לכן הרשימה חיה כאן, ושני הצדדים קוראים ממנה.
 */
export const SITE_EMAIL_TEMPLATES = [
  { id: 'password_reset', label: 'איפוס סיסמה' },
  { id: 'password_changed', label: 'הסיסמה הוחלפה' },
  { id: 'contact_ack', label: 'אישור קבלת פנייה (לפונה)' },
  { id: 'contact_staff', label: 'התראה על פנייה חדשה (לצוות)' },
  { id: 'contact_reply', label: 'מענה לפנייה' },
  { id: 'team_invite', label: 'הזמנת איש צוות' },
] as const;

export type SiteEmailTemplate = (typeof SITE_EMAIL_TEMPLATES)[number]['id'];
