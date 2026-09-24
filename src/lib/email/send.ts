import 'server-only';

import type { RenderedEmail } from './brand';
import { defaultReplyTo, fromAddress, type EmailRole } from './addresses';

export {
  EMAIL_DOMAIN,
  contactAddress,
  fromAddress,
  replyToForInquiry,
  staffInbox,
} from './addresses';
export type { EmailRole } from './addresses';

/**
 * [1.40] שליחת דואר — שכבה אחת מעל ספק הדואר, לכל האתר.
 *
 * הספק (Resend, דרך REST ובלי תלות חבילה) היה עד כה מוסתר בתוך
 * lib/commerce/notifications.ts, ומודולים אחרים שנזקקו לדואר —
 * מענה לפנייה, הזמנת איש צוות — יובאו משם פונקציה בשם sendPlainEmail
 * שגם עטפה את ה-HTML בעטיפת RTL מאולתרת משלה. התוצאה: אותו אתר שלח
 * הודעות בשלושה מראות שונים.
 *
 * כאן הכול עובר במקום אחד: אותה מעטפת מותגת (brand.ts), אותה גרסת
 * טקסט, ואותו טיפול בשגיאות.
 *
 * "לא מוגדר" אינו "נכשל": בלי RESEND_API_KEY התוצאה היא skipped, וכל
 * קורא מחליט בעצמו אם זה מצדיק להיכשל. זרימה כספית לעולם אינה נופלת
 * בגלל דואר; איפוס סיסמה, לעומת זאת, כן חייב לדעת שההודעה לא יצאה.
 *
 * ‏[1.41] כתובת השולח וכתובת המענה נקבעות לפי **תפקיד** ההודעה ולא
 * לפי הקורא — ראו lib/email/addresses.ts. התפקידים והכתובות מוגדרים
 * שם; כאן רק מרכיבים את הבקשה.
 */

export interface SendResult {
  ok: boolean;
  /** true כשאין ספק מוגדר — ההודעה לא נשלחה, וזו אינה תקלה. */
  skipped?: boolean;
  id?: string;
  error?: string;
}

export interface SendOptions {
  /** ברירת המחדל: 'automated' — הרוב המוחלט של דואר האתר. */
  role?: EmailRole;
  /**
   * שלושה מצבים, ושלושתם נחוצים:
   *   undefined — ברירת המחדל של התפקיד (ל-automated: אין).
   *   כתובת    — Reply-To מפורש. כך מקבלת התראת הפנייה לצוות את
   *              כתובת הפונה, וכך מקבלות הודעות אוטומטיות שמזמינות
   *              תגובה את contact@.
   *   null     — בלי Reply-To, ובמפורש. זה המצב של איפוס סיסמה.
   */
  replyTo?: string | string[] | null;
}

export async function sendEmail(
  to: string | string[],
  email: RenderedEmail,
  options: SendOptions = {},
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' };

  const recipients = (Array.isArray(to) ? to : [to]).filter((address) => address.trim() !== '');
  if (recipients.length === 0) return { ok: false, error: 'no recipient' };

  const role = options.role ?? 'automated';
  // ‏=== undefined ולא ?? : null הוא בחירה מפורשת ב"בלי Reply-To",
  // ואסור שייפול חזרה לברירת המחדל של התפקיד.
  const requested = options.replyTo === undefined ? defaultReplyTo(role) : options.replyTo;
  const replyTo = (requested == null ? [] : Array.isArray(requested) ? requested : [requested])
    .map((address) => address.trim())
    .filter((address) => address !== '');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromAddress(role),
        to: recipients,
        subject: email.subject,
        html: email.html,
        // גרסת טקסט תמיד. מסנני דואר זבל מורידים ציון להודעת HTML
        // בלבד, וחלק מהלקוחות (וחלק מהשעונים החכמים) מציגים אותה.
        text: email.text,
        // נשלח רק כשיש מה לשלוח: reply_to ריק הוא שדה מיותר בבקשה.
        ...(replyTo.length > 0 ? { reply_to: replyTo } : {}),
      }),
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      console.error('[email:send]', response.status, data.message);
      return { ok: false, error: data.message ?? `provider ${response.status}` };
    }
    return { ok: true, id: data.id };
  } catch (error) {
    // כשל רשת מול הספק — לא חריגה שמפילה את הקורא.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email:send] network', message);
    return { ok: false, error: message };
  }
}
