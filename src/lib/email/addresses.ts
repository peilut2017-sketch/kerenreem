import 'server-only';

/**
 * ‏[1.41] כתובות הדואר של האתר — מקור אמת אחד.
 *
 * עד כה הכתובות היו מפוזרות בשלושה מקומות: קבוע בקוד, משתנה סביבה
 * בשם ‎COMMERCE_EMAIL_FROM (ששלט מזמן בכל דואר האתר, לא רק במסחר),
 * והגדרות האתר במסד. לא היה מקום אחד שבו רואים "מאיזו כתובת יוצא מה",
 * ובוודאי לא דרך להבדיל בין דואר אוטומטי למענה אנושי בלי לשנות קוד.
 *
 * המודול הזה מגדיר **תפקידים**, לא כתובות. קוד קורא אומר "זו הודעה
 * אוטומטית" או "זה מענה אנושי", והכתובת היא פרט יישום:
 *
 *   automated → no-reply@  — נשלח בידי מכונה. אין הבטחה שמישהו קורא
 *                            תשובה, ולכן אין ל-role הזה Reply-To
 *                            כברירת מחדל. הודעה אוטומטית שכן מזמינה
 *                            תגובה מציינת ‎replyTo במפורש.
 *   human     → contact@   — נכתב בידי אדם, והנמען יענה. כאן Reply-To
 *                            אל contact@ הוא ברירת המחדל, כי זו כל
 *                            מטרת התפקיד.
 *
 * למה אין ברירת מחדל ל-automated: ברירת מחדל גלובלית הייתה מדביקה
 * Reply-To גם להודעות שבמכוון אינן מזמינות תגובה — איפוס סיסמה,
 * למשל, שבו הזמנה לענות במייל היא הזמנה לשלוח סיסמה בטקסט פתוח.
 * "שקט" צריך להיות ברירת המחדל, ותגובה צריכה להיות החלטה מפורשת.
 */

/** דומיין השליחה של המכון. הדואר היוצא חתום עליו (SPF/DKIM). */
export const EMAIL_DOMAIN = 'kerenreem.org';

export type EmailRole = 'automated' | 'human';

const DEFAULT_LABEL = 'מכון קרן רא״ם';

/** התיבה שממנה יוצא כל תפקיד, כשלא הוגדר אחרת בסביבה. */
const DEFAULT_MAILBOX: Record<EmailRole, string> = {
  automated: 'no-reply',
  human: 'contact',
};

/**
 * ‏COMMERCE_EMAIL_FROM נשאר נתמך כשם מיושן ל-EMAIL_FROM_AUTOMATED: הוא
 * מוגדר בפריסה הקיימת, ופריסה שעולה עם הגרסה הזו לא אמורה להתחיל
 * לשלוח מכתובת אחרת בלי שאיש ביקש.
 */
function configuredFrom(role: EmailRole): string | undefined {
  const raw =
    role === 'automated'
      ? (process.env.EMAIL_FROM_AUTOMATED ?? process.env.COMMERCE_EMAIL_FROM)
      : process.env.EMAIL_FROM_CONTACT;
  return raw?.trim() || undefined;
}

/** כתובת השולח של תפקיד, בצורה `שם תצוגה <כתובת>`. */
export function fromAddress(role: EmailRole): string {
  return configuredFrom(role) ?? `${DEFAULT_LABEL} <${DEFAULT_MAILBOX[role]}@${EMAIL_DOMAIN}>`;
}

/**
 * הכתובת שאפשר להשיב אליה. תיבה שמישהו קורא — להבדיל מ-no-reply@.
 * זהו המקור היחיד שלה בקוד, וזו הנקודה שתשתנה ביום שנעבור מקבלה
 * ב-Cloudflare Email Routing לקליטה ישירה ב-Resend Inbound.
 */
export function contactAddress(): string {
  return process.env.EMAIL_REPLY_TO_CONTACT?.trim() || `contact@${EMAIL_DOMAIN}`;
}

/**
 * ברירת המחדל ל-Reply-To לפי תפקיד. ל-automated אין — ראו ההסבר
 * בראש הקובץ.
 */
export function defaultReplyTo(role: EmailRole): string | undefined {
  return role === 'human' ? contactAddress() : undefined;
}

/**
 * כתובת המענה של מענה לפנייה — התפר לקליטת תשובות אוטומטית בעתיד.
 *
 * כדי שתשובה של פונה תיקלט אל הפנייה הנכונה, היא צריכה לחזור לכתובת
 * שמזהה את הפנייה: ‎contact+inq-123@kerenreem.org. גם Cloudflare Email
 * Routing וגם Resend Inbound יודעים להתאים כתובת כזו לכלל של
 * ‎contact@ (subaddressing) ולשמר את הסיומת.
 *
 * הפונקציה מחזירה כרגע את contact@ נטו, ובכוונה: **אין עדיין מנגנון
 * שמכניס תשובות לפנייה באתר**, וכתובת שמבטיחה קליטה אוטומטית לפני
 * שהיא קיימת גרועה מכתובת פשוטה. אתרי הקריאה כבר עוברים דרך כאן, ולכן
 * ההפעלה תהיה שינוי בגוף הפונקציה הזו בלבד.
 */
export function replyToForInquiry(inquiryId?: string | number | null): string {
  void inquiryId;
  return contactAddress();
}

/**
 * כתובת היעד להודעות פנימיות (פנייה חדשה, התראות תפעול) — להבדיל
 * מכתובת השולח. זו תיבה אמיתית של הצוות, ולא חייבת להיות על הדומיין.
 */
export function staffInbox(contactEmail: string | null): string | null {
  const configured = process.env.SITE_NOTIFICATIONS_EMAIL?.trim();
  return configured || contactEmail || null;
}
