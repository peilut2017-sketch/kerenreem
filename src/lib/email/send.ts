import 'server-only';

import type { RenderedEmail } from './brand';
import { createServiceClient } from '@/lib/supabase/service';
import { defaultReplyTo, fromAddress, type EmailRole } from './addresses';
import { injectTrackingPixel, trackingPixelUrl } from './tracking';

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

/** קובץ מצורף להודעה. הגוף נשלח לספק כ-base64 (המגבלה שלו: 40MB להודעה כולה). */
export interface MailAttachment {
  filename: string;
  content: Uint8Array;
}

export interface SendResult {
  ok: boolean;
  /** true כשאין ספק מוגדר — ההודעה לא נשלחה, וזו אינה תקלה. */
  skipped?: boolean;
  id?: string;
  /** מזהה רשומת המעקב (email_log), אם נרשמה — לקישור מרשומות אחרות. */
  logId?: string;
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
  /** שם הסוג, לסינון ולהצגה במסך הדואר היוצא (contact_reply, shipped…). */
  label?: string;
  /** רשומה שההודעה שייכת לה — הזמנה, פנייה. טקסט חופשי: טבלה + מזהה. */
  related?: { table: string; id: string };
  /** קבצים מצורפים. סך הגודל באחריות הקורא (ראו lib/email/attachments.ts). */
  attachments?: MailAttachment[];
  /** false = בלי פיקסל מעקב ובלי רישום ביומן. ברירת מחדל: מעקב. */
  track?: boolean;
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

  /*
   * ‏[1.44] רישום ביומן *לפני* השליחה: מזהה השורה הוא חלק מכתובת הפיקסל
   * שבתוך ה-HTML. כשל ברישום (אין מסד, אין כתובת אתר) אינו מונע את
   * השליחה — ההודעה יוצאת בלי מעקב, כי דואר שלא יצא חמור מדואר בלי מעקב.
   */
  const logId = (await openLogRow(recipients, email, role, options)) ?? undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const html = logId && siteUrl ? injectTrackingPixel(email.html, trackingPixelUrl(siteUrl, logId)) : email.html;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromAddress(role),
        to: recipients,
        subject: email.subject,
        html,
        // גרסת טקסט תמיד. מסנני דואר זבל מורידים ציון להודעת HTML
        // בלבד, וחלק מהלקוחות (וחלק מהשעונים החכמים) מציגים אותה.
        text: email.text,
        // נשלח רק כשיש מה לשלוח: reply_to ריק הוא שדה מיותר בבקשה.
        ...(replyTo.length > 0 ? { reply_to: replyTo } : {}),
        ...(options.attachments?.length
          ? {
              attachments: options.attachments.map((file) => ({
                filename: file.filename,
                content: Buffer.from(file.content).toString('base64'),
              })),
            }
          : {}),
      }),
      cache: 'no-store',
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!response.ok) {
      console.error('[email:send]', response.status, data.message);
      const error = data.message ?? `provider ${response.status}`;
      await closeLogRow(logId, { status: 'failed', error });
      return { ok: false, logId, error };
    }
    await closeLogRow(logId, { status: 'sent', provider_id: data.id ?? null });
    return { ok: true, id: data.id, logId };
  } catch (error) {
    // כשל רשת מול הספק — לא חריגה שמפילה את הקורא.
    const message = error instanceof Error ? error.message : String(error);
    console.error('[email:send] network', message);
    await closeLogRow(logId, { status: 'failed', error: message });
    return { ok: false, logId, error: message };
  }
}

async function openLogRow(
  recipients: string[],
  email: RenderedEmail,
  role: EmailRole,
  options: SendOptions,
): Promise<string | null> {
  if (options.track === false) return null;
  const service = createServiceClient();
  if (!service) return null;

  const { data, error } = await service
    .from('email_log')
    .insert({
      to_address: recipients.join(', ').slice(0, 500),
      subject: email.subject.slice(0, 300),
      label: options.label ?? null,
      role,
      related_table: options.related?.table ?? null,
      related_id: options.related?.id ?? null,
    })
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[email:log] insert', error.code, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function closeLogRow(
  logId: string | undefined,
  fields: { status: 'sent' | 'failed'; provider_id?: string | null; error?: string },
): Promise<void> {
  if (!logId) return;
  const service = createServiceClient();
  if (!service) return;
  const { error } = await service.from('email_log').update(fields).eq('id', logId);
  if (error) console.error('[email:log] update', error.code, error.message);
}
