import 'server-only';

import PostalMime from 'postal-mime';
import { writeAuditLog } from '@/lib/admin/audit';
import { hasRole } from '@/lib/admin/roles';
import { getSiteSettings } from '@/lib/data';
import { htmlToPlainText } from '@/lib/html-text';
import { sanitizeHtml } from '@/lib/sanitize';
import { createServiceClient } from '@/lib/supabase/service';
import type { UserRole } from '@/lib/supabase/types';
import { readInquiryInboxes, resolveInquiryInbox } from './inbox';
import {
  inquiryReplyAddress,
  parseInquiryReplyAddress,
  stripQuotedReply,
  textToHtml,
} from './inquiry-thread';
import { contactAddress, replyToForInquiry, sendEmail } from './send';
import { contactReplyEmail, inquiryFollowUpEmail } from './templates';
import { staffInbox } from './addresses';
import { storeInboundFiles, type InboundFile } from './attachments';

/**
 * ‏[1.43] קליטת תשובת צוות במייל אל שרשור הפנייה.
 *
 * הזרימה: איש צוות עונה להתראת הפנייה ← Cloudflare Email Routing ←
 * Email Worker ← POST ‎/api/email/inbound ← כאן. התשובה:
 *   1. מאומתת — כתובת המענה החתומה, ושולח שהוא איש צוות;
 *   2. מנוקה מהציטוט של ההודעה המקורית;
 *   3. נשלחת לפונה מ-contact@ (בדיוק כמו מענה מהניהול);
 *   4. נשמרת ב-contact_replies עם source='email', ומעבירה את הפנייה
 *      ל"בטיפול".
 *
 * ‏outcome.retry קובע אם ה-Worker יעביר את המייל המקורי לתיבת הגיבוי:
 * כל כישלון שבו הפונה לא קיבל תשובה → גיבוי (הצוות רואה אותה במקום
 * שהיא תיעלם); הצלחה, כפילות ודחייה מכוונת → לא.
 */

export type InboundOutcome =
  | { status: 'recorded'; httpStatus: 200 }
  | { status: 'duplicate'; httpStatus: 200 }
  | { status: 'ignored'; httpStatus: 200 }
  | { status: 'rejected'; httpStatus: 422; reason: string }
  | { status: 'failed'; httpStatus: 502 | 503; reason: string };

/** תפקיד מינימלי לתשובה במייל — כמו הרשאת המענה בניהול (can_edit). */
const MIN_ROLE: UserRole = 'editor';

interface Sender {
  userId: string | null;
}

/**
 * איש צוות? משתמש ניהול בתפקיד עורך ומעלה, או אחת מתיבות הצוות
 * שהוגדרו לקבלת פניות (תיבה משותפת שאינה חשבון ניהול).
 */
async function authorizeSender(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  address: string,
): Promise<Sender | null> {
  const wanted = address.trim().toLowerCase();

  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users?.users.find((candidate) => candidate.email?.toLowerCase() === wanted);
  if (user) {
    const { data: profile } = await service
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && hasRole(profile.role as UserRole, MIN_ROLE)) return { userId: user.id };
  }

  const inboxes = await readInquiryInboxes();
  const settings = await getSiteSettings();
  const known = [inboxes.general, inboxes.book, staffInbox(settings.contact?.email ?? null)]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());

  return known.includes(wanted) ? { userId: null } : null;
}

/** מענה אוטומטי (חופשה, "הודעה התקבלה") — לא תשובה של אדם ואסור לקלוט אותו. */
function isAutoReply(headers: { key: string; value: string }[]): boolean {
  const get = (name: string) => headers.find((header) => header.key === name)?.value.toLowerCase() ?? '';
  const autoSubmitted = get('auto-submitted');
  return (
    (autoSubmitted !== '' && autoSubmitted !== 'no') ||
    get('x-autoreply') !== '' ||
    get('x-autorespond') !== '' ||
    ['bulk', 'auto_reply', 'junk'].includes(get('precedence'))
  );
}

export async function processInboundReply(
  raw: ArrayBuffer,
  recipient: string,
): Promise<InboundOutcome> {
  const service = createServiceClient();
  if (!service) return { status: 'failed', httpStatus: 503, reason: 'no service client' };

  const inquiryId = parseInquiryReplyAddress(recipient);
  if (!inquiryId) return { status: 'rejected', httpStatus: 422, reason: 'bad reply address' };

  const parsed = await PostalMime.parse(raw);
  const fromAddress = parsed.from?.address?.trim().toLowerCase();

  if (!fromAddress) return { status: 'rejected', httpStatus: 422, reason: 'no sender' };

  // מענה אוטומטי נבלע בשקט: דחייה הייתה מעבירה אותו לתיבת הגיבוי של הצוות
  if (isAutoReply(parsed.headers ?? [])) return { status: 'ignored', httpStatus: 200 };

  const externalId = parsed.messageId?.trim().slice(0, 998) || null;
  if (externalId) {
    const { data: existing } = await service
      .from('contact_replies')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();
    if (existing) return { status: 'duplicate', httpStatus: 200 };
  }

  const { data: inquiry } = await service
    .from('contact_messages')
    .select('id, name, email, subject, status, kind')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inquiry) return { status: 'rejected', httpStatus: 422, reason: 'inquiry not found' };

  // מייל HTML בלבד (אין חלק text) → מקבלים טקסט דרך המרה גסה
  const text = parsed.text ?? htmlToPlainText(parsed.html, 20_000);
  // קבצים מצורפים אמיתיים בלבד — לא תמונות מוטמעות בחתימה (inline)
  const files: InboundFile[] = (parsed.attachments ?? [])
    .filter((attachment) => attachment.disposition !== 'inline' || !attachment.contentId)
    .map((attachment) => ({
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      content: attachment.content,
    }));

  let body = stripQuotedReply(text);
  // תשובה שהיא קובץ בלבד היא תשובה תקינה
  if (!body && files.length > 0) body = '(קבצים מצורפים)';
  if (!body) return { status: 'rejected', httpStatus: 422, reason: 'empty reply' };

  const cleanHtml = sanitizeHtml(textToHtml(body));
  if (cleanHtml.length > 20_000) return { status: 'rejected', httpStatus: 422, reason: 'reply too long' };

  // השולח הוא הפונה עצמו → תשובה *שלו*; אחרת → מענה של הצוות.
  // הכתובת החתומה היא ההרשאה בשני המקרים; ‎From‎ ניתן לזיוף, ולכן תשובת
  // "פונה" מזויפת מסתכמת בהודעה נוספת בשרשור והתראה לצוות — לא יותר.
  if (fromAddress === inquiry.email.trim().toLowerCase()) {
    return recordVisitorReply({ service, inquiry, cleanHtml, body, files, fromAddress, externalId });
  }
  return recordStaffReply({ service, inquiry, cleanHtml, files, fromAddress, externalId });
}

type Service = NonNullable<ReturnType<typeof createServiceClient>>;
interface InquiryRow {
  id: string;
  name: string | null;
  email: string;
  subject: string | null;
  status: string;
  kind: string | null;
}

/** תשובת צוות במייל: נשלחת לפונה ונשמרת בשרשור. */
async function recordStaffReply(input: {
  service: Service;
  inquiry: InquiryRow;
  cleanHtml: string;
  files: InboundFile[];
  fromAddress: string;
  externalId: string | null;
}): Promise<InboundOutcome> {
  const { service, inquiry, cleanHtml, files, fromAddress, externalId } = input;

  const sender = await authorizeSender(service, fromAddress);
  if (!sender) return { status: 'rejected', httpStatus: 422, reason: 'sender is not staff' };

  const subject = inquiry.subject
    ? `מענה לפנייתך: ${inquiry.subject}`.slice(0, 160)
    : 'מענה לפנייתך למכון קרן רא״ם';

  // הקבצים נשמרים בשרשור ומועברים לפונה (כולם — הצוות מהימן, גם אם הסוג אינו נשמר)
  const { stored, mail } = await storeInboundFiles(files, `replies/${inquiry.id}`);

  const message = await contactReplyEmail({
    name: inquiry.name ?? null,
    subject,
    bodyHtml: cleanHtml,
    bodyText: htmlToPlainText(cleanHtml, 20_000),
    attachmentNames: mail.map((file) => file.filename),
  });
  const sent = await sendEmail(inquiry.email, message, {
    role: 'human',
    attachments: mail,
    replyTo: replyToForInquiry(inquiry.id),
    label: 'contact_reply',
    related: { table: 'contact_messages', id: inquiry.id },
  });
  // לא נשלח ולא "skipped" → אין תשובה אצל הפונה; הצוות יקבל את המייל המקורי.
  // ‏skipped (אין RESEND_API_KEY) → נשמר בשרשור בלבד, כמו במענה מהניהול.
  if (!sent.ok && !sent.skipped) {
    return { status: 'failed', httpStatus: 502, reason: sent.error ?? 'send failed' };
  }

  const { error: insertError } = await service.from('contact_replies').insert({
    message_id: inquiry.id,
    user_id: sender.userId,
    body_html: cleanHtml,
    sent_to: inquiry.email,
    delivery_status: sent.ok ? 'sent' : 'skipped',
    source: 'email',
    direction: 'out',
    from_email: fromAddress,
    external_id: externalId,
    email_log_id: sent.logId ?? null,
    attachments: stored,
  });
  if (insertError) {
    // התשובה כבר הגיעה לפונה. כישלון שמירה אינו סיבה לנסות שוב (כפל מענה).
    console.error('[inbound] שמירת מענה נכשלה', insertError.code, insertError.message);
  }

  if (inquiry.status !== 'resolved') {
    await service
      .from('contact_messages')
      .update({ status: 'in_progress', unread_reply: false })
      .eq('id', inquiry.id)
      .neq('status', 'resolved');
  }

  await writeAuditLog(null, sender.userId, 'reply', 'contact_messages', inquiry.id, {
    newValues: { sent_to: inquiry.email, via: 'email', from: fromAddress },
    context: `מענה במייל לפנייה של ${inquiry.name}`,
  });

  return { status: 'recorded', httpStatus: 200 };
}

/**
 * תשובת הפונה למענה (או לאישור הקבלה): נשמרת בשרשור, הפנייה חוזרת למצב
 * "חדשה" כדי שתעלה בתיבה ובמונה, והצוות מקבל התראה עם כפתור לפנייה.
 */
async function recordVisitorReply(input: {
  service: Service;
  inquiry: InquiryRow;
  cleanHtml: string;
  body: string;
  files: InboundFile[];
  fromAddress: string;
  externalId: string | null;
}): Promise<InboundOutcome> {
  const { service, inquiry, cleanHtml, body, files, fromAddress, externalId } = input;

  // סוגים שאינם מותרים באחסון (zip, הרצה…) אינם נשמרים ואינם מועברים לצוות
  // כקובץ — מפונה חיצוני לא מעבירים הלאה קובץ שאינו ברשימת הסוגים המותרים.
  const { stored, mail } = await storeInboundFiles(files, `replies/${inquiry.id}`);
  const safeMail = mail.filter((_, index) => stored[index].path !== null);
  const { error: insertError } = await service.from('contact_replies').insert({
    message_id: inquiry.id,
    user_id: null,
    body_html: cleanHtml,
    sent_to: contactAddress(),
    delivery_status: 'sent',
    source: 'email',
    direction: 'in',
    from_email: fromAddress,
    external_id: externalId,
    attachments: stored,
  });
  if (insertError) {
    // לא נשמר → כישלון, וה-Worker מעביר את המייל המקורי לתיבת הצוות
    console.error('[inbound] שמירת תשובת פונה נכשלה', insertError.code, insertError.message);
    return { status: 'failed', httpStatus: 502, reason: insertError.message };
  }

  await service
    .from('contact_messages')
    .update({ status: 'awaiting_reply', unread_reply: true, is_handled: false })
    .eq('id', inquiry.id);

  // התראה לצוות — best-effort: ההודעה כבר בשרשור ובמונה "חדשות"
  try {
    const inbox = await resolveInquiryInbox(inquiry.kind === 'book_feedback' ? 'book' : 'general');
    if (inbox) {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
      const email = await inquiryFollowUpEmail({
        name: inquiry.name ?? inquiry.email,
        subject: inquiry.subject,
        message: body,
        inboxUrl: siteUrl ? `${siteUrl}/admin/messages?open=${inquiry.id}` : null,
        replyByEmail: inquiryReplyAddress(inquiry.id) !== null,
        attachmentNames: safeMail.map((file) => file.filename),
      });
      await sendEmail(inbox, email, {
        replyTo: inquiryReplyAddress(inquiry.id) ?? inquiry.email,
        attachments: safeMail,
        label: 'inquiry_followup',
        related: { table: 'contact_messages', id: inquiry.id },
      });
    }
  } catch (error) {
    console.error('[inbound] התראת תשובת פונה נכשלה', error);
  }

  return { status: 'recorded', httpStatus: 200 };
}
