import 'server-only';

import PostalMime from 'postal-mime';
import { writeAuditLog } from '@/lib/admin/audit';
import { hasRole } from '@/lib/admin/roles';
import { getSiteSettings } from '@/lib/data';
import { htmlToPlainText } from '@/lib/html-text';
import { sanitizeHtml } from '@/lib/sanitize';
import { createServiceClient } from '@/lib/supabase/service';
import type { UserRole } from '@/lib/supabase/types';
import { readInquiryInboxes } from './inbox';
import { parseInquiryReplyAddress, stripQuotedReply, textToHtml } from './inquiry-thread';
import { contactAddress, sendEmail } from './send';
import { contactReplyEmail } from './templates';
import { staffInbox } from './addresses';

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

export async function processInboundReply(raw: ArrayBuffer, recipient: string): Promise<InboundOutcome> {
  const service = createServiceClient();
  if (!service) return { status: 'failed', httpStatus: 503, reason: 'no service client' };

  const inquiryId = parseInquiryReplyAddress(recipient);
  if (!inquiryId) return { status: 'rejected', httpStatus: 422, reason: 'bad reply address' };

  const parsed = await PostalMime.parse(raw);
  const fromAddress = parsed.from?.address?.trim().toLowerCase();
  if (!fromAddress) return { status: 'rejected', httpStatus: 422, reason: 'no sender' };

  const sender = await authorizeSender(service, fromAddress);
  if (!sender) return { status: 'rejected', httpStatus: 422, reason: 'sender is not staff' };

  const externalId = parsed.messageId?.trim().slice(0, 998) || null;
  if (externalId) {
    const { data: existing } = await service
      .from('contact_replies')
      .select('id')
      .eq('external_id', externalId)
      .maybeSingle();
    if (existing) return { status: 'duplicate', httpStatus: 200 };
  }

  // מייל HTML בלבד (אין חלק text) → מקבלים טקסט דרך המרה גסה
  const text = parsed.text ?? htmlToPlainText(parsed.html, 20_000);
  const body = stripQuotedReply(text);
  if (!body) return { status: 'rejected', httpStatus: 422, reason: 'empty reply' };

  const { data: inquiry } = await service
    .from('contact_messages')
    .select('id, name, email, subject, status')
    .eq('id', inquiryId)
    .maybeSingle();
  if (!inquiry) return { status: 'rejected', httpStatus: 422, reason: 'inquiry not found' };

  const cleanHtml = sanitizeHtml(textToHtml(body));
  if (cleanHtml.length > 20_000) return { status: 'rejected', httpStatus: 422, reason: 'reply too long' };

  const subject = inquiry.subject
    ? `מענה לפנייתך: ${inquiry.subject}`.slice(0, 160)
    : 'מענה לפנייתך למכון קרן רא״ם';

  const message = await contactReplyEmail({
    name: inquiry.name ?? null,
    subject,
    bodyHtml: cleanHtml,
    bodyText: htmlToPlainText(cleanHtml, 20_000),
  });
  const sent = await sendEmail(inquiry.email, message, {
    role: 'human',
    replyTo: contactAddress(),
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
    from_email: fromAddress,
    external_id: externalId,
  });
  if (insertError) {
    // התשובה כבר הגיעה לפונה. כישלון שמירה אינו סיבה לנסות שוב (כפל מענה).
    console.error('[inbound] שמירת מענה נכשלה', insertError.code, insertError.message);
  }

  if (inquiry.status !== 'resolved') {
    await service
      .from('contact_messages')
      .update({ status: 'in_progress' })
      .eq('id', inquiry.id)
      .neq('status', 'resolved');
  }

  await writeAuditLog(null, sender.userId, 'reply', 'contact_messages', inquiry.id, {
    newValues: { sent_to: inquiry.email, via: 'email', from: fromAddress },
    context: `מענה במייל לפנייה של ${inquiry.name}`,
  });

  return { status: 'recorded', httpStatus: 200 };
}
