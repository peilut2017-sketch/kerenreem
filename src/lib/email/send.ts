import 'server-only';

import type { RenderedEmail } from './brand';

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
 */

export interface SendResult {
  ok: boolean;
  /** true כשאין ספק מוגדר — ההודעה לא נשלחה, וזו אינה תקלה. */
  skipped?: boolean;
  id?: string;
  error?: string;
}

/** כתובת השולח. ניתנת לשינוי בהגדרות הסביבה, עם ברירת מחדל שמורה. */
function fromAddress(): string {
  return process.env.COMMERCE_EMAIL_FROM ?? 'מכון קרן רא״ם <no-reply@keren-reem.org>';
}

/**
 * כתובת היעד להודעות פנימיות (פנייה חדשה, התראות תפעול). נופלת חזרה
 * לכתובת יצירת הקשר שבהגדרות האתר כשלא הוגדרה כתובת ייעודית.
 */
export function staffInbox(contactEmail: string | null): string | null {
  const configured = process.env.SITE_NOTIFICATIONS_EMAIL?.trim();
  return configured || contactEmail || null;
}

export async function sendEmail(to: string | string[], email: RenderedEmail): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' };

  const recipients = (Array.isArray(to) ? to : [to]).filter((address) => address.trim() !== '');
  if (recipients.length === 0) return { ok: false, error: 'no recipient' };

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromAddress(),
        to: recipients,
        subject: email.subject,
        html: email.html,
        // גרסת טקסט תמיד. מסנני דואר זבל מורידים ציון להודעת HTML
        // בלבד, וחלק מהלקוחות (וחלק מהשעונים החכמים) מציגים אותה.
        text: email.text,
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
