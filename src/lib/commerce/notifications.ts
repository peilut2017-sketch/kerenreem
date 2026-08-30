import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from '@/lib/supabase/types';
import { formatPrice } from './pricing';

/**
 * ערוץ ההודעות (פרק 15 במסמך האב). מייל הוא ערוץ הבסיס — נשלח על כל
 * אירוע, תמיד; SMS/וואטסאפ הם תוספת עתידית (שלב 7) מאחורי הסכמה.
 *
 * ספק המייל מופשט מאחורי sendViaProvider: ברירת המחדל Resend דרך REST
 * (בלי תלות חבילה); בהיעדר RESEND_API_KEY ההודעה נרשמת ב-notification_log
 * במצב skipped — הזרימה הכספית לעולם אינה נכשלת בגלל מייל.
 *
 * Idempotency במסד: מפתח ייחודי order:{id}:{template}:{channel} —
 * קריאה חוזרת (Webhook כפול, retry) אינה שולחת מייל שני.
 */

export type EmailTemplate =
  | 'order_confirmation'
  | 'order_updated'
  | 'payment_received'
  | 'payment_failed'
  | 'document_ready'
  | 'shipped'
  | 'ready_for_pickup'
  | 'cancelled'
  | 'refunded';

interface RenderedEmail {
  subject: string;
  html: string;
}

const FOOTER =
  '<p style="color:#8a8577;font-size:13px;margin-top:32px">מכון קרן רא״ם · לשאלות אפשר להשיב למייל הזה או להתקשר אלינו.</p>';

function orderHeader(order: Order): string {
  return `<p>שלום ${escapeHtml(order.contact_name ?? '')},</p>`;
}

function orderLinesTable(items: { title: string; quantity: number; lineTotal: number }[]): string {
  const rows = items
    .map(
      (item) =>
        `<tr><td style="padding:4px 8px">${escapeHtml(item.title)}</td>` +
        `<td style="padding:4px 8px">×${item.quantity}</td>` +
        `<td style="padding:4px 8px">${formatPrice(item.lineTotal)}</td></tr>`,
    )
    .join('');
  return `<table dir="rtl" style="border-collapse:collapse">${rows}</table>`;
}

export function renderEmail(
  template: EmailTemplate,
  order: Order,
  extra: {
    items?: { title: string; quantity: number; lineTotal: number }[];
    trackUrl?: string;
    documentUrl?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    promisedDateLabel?: string | null;
    refundAmount?: number;
    /** [1.2] קישור תשלום מורנינג — להזמנה טלפונית (פרק 9.6) */
    paymentUrl?: string | null;
    /** [1.3] סיבת עדכון ההזמנה — מוצגת ללקוח במייל order_updated */
    updateReason?: string | null;
  } = {},
): RenderedEmail {
  const n = order.order_number;
  const total = formatPrice(order.total, order.locale, { alwaysAgorot: true });
  const track = extra.trackUrl
    ? `<p><a href="${extra.trackUrl}">לצפייה בהזמנה ולמעקב</a></p>`
    : '';
  const payLink = extra.paymentUrl
    ? `<p style="margin:16px 0"><a href="${extra.paymentUrl}" style="background:#1f1c17;color:#fff;border-radius:999px;padding:12px 24px;text-decoration:none;display:inline-block">לתשלום מאובטח — ${total}</a></p><p style="color:#8a8577;font-size:13px">התשלום מתבצע בדף המאובטח של חשבונית ירוקה. הקישור בתוקף מוגבל.</p>`
    : '';

  switch (template) {
    case 'order_confirmation':
      return {
        subject: `הזמנה ${n} התקבלה — מכון קרן רא״ם`,
        html: `${orderHeader(order)}<p>הזמנתך <strong>${n}</strong> נקלטה וממתינה להשלמת התשלום.</p>${
          extra.items ? orderLinesTable(extra.items) : ''
        }<p>סה״כ לתשלום: <strong>${total}</strong></p>${payLink}${
          extra.promisedDateLabel ? `<p>אספקה משוערת: ${extra.promisedDateLabel}</p>` : ''
        }${track}${FOOTER}`,
      };
    case 'order_updated':
      return {
        subject: `עדכון בהזמנה ${n} — מכון קרן רא״ם`,
        html: `${orderHeader(order)}<p>הזמנה <strong>${n}</strong> עודכנה על ידי הצוות.</p>${
          extra.updateReason ? `<p>הסיבה: ${escapeHtml(extra.updateReason)}</p>` : ''
        }${
          extra.items ? orderLinesTable(extra.items) : ''
        }<p>הסכום המעודכן לתשלום: <strong>${total}</strong></p>${payLink}${track}${FOOTER}`,
      };
    case 'payment_received':
      return {
        subject: `התשלום התקבל — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>התשלום על הזמנה <strong>${n}</strong> התקבל בהצלחה. סה״כ: <strong>${total}</strong>.</p>${
          extra.promisedDateLabel ? `<p>אספקה משוערת: ${extra.promisedDateLabel}</p>` : ''
        }${
          extra.documentUrl
            ? `<p><a href="${extra.documentUrl}">לצפייה במסמך החשבונאי</a></p>`
            : '<p>המסמך החשבונאי יישלח אליך בנפרד.</p>'
        }${track}${FOOTER}`,
      };
    case 'payment_failed':
      return {
        subject: `התשלום לא הושלם — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>התשלום על הזמנה <strong>${n}</strong> לא הושלם. אפשר לנסות שוב מהקישור, או להזמין בטלפון — נשמח לעזור.</p>${track}${FOOTER}`,
      };
    case 'document_ready':
      return {
        subject: `המסמך החשבונאי מוכן — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>המסמך החשבונאי על הזמנה <strong>${n}</strong> מוכן.</p>${
          extra.documentUrl ? `<p><a href="${extra.documentUrl}">לצפייה ולהורדה</a></p>` : ''
        }${track}${FOOTER}`,
      };
    case 'shipped':
      return {
        subject: `ההזמנה בדרך אליך — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>הזמנה <strong>${n}</strong> נמסרה לשליח.</p>${
          extra.items ? orderLinesTable(extra.items) : ''
        }${
          extra.trackingNumber
            ? `<p>מספר מעקב: <strong dir="ltr">${escapeHtml(extra.trackingNumber)}</strong>${
                extra.trackingUrl ? ` · <a href="${extra.trackingUrl}">מעקב אצל חברת המשלוחים</a>` : ''
              }</p>`
            : ''
        }${extra.promisedDateLabel ? `<p>אספקה משוערת: ${extra.promisedDateLabel}</p>` : ''}${track}${FOOTER}`,
      };
    case 'ready_for_pickup':
      return {
        subject: `ההזמנה מוכנה לאיסוף — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>הזמנה <strong>${n}</strong> מוכנה לאיסוף במכון. נשמח לראותך!</p>${track}${FOOTER}`,
      };
    case 'cancelled':
      return {
        subject: `ההזמנה בוטלה — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>הזמנה <strong>${n}</strong> בוטלה. אם שולם — הזיכוי בדרך, ואישור נפרד יישלח.</p>${FOOTER}`,
      };
    case 'refunded':
      return {
        subject: `בוצע זיכוי — הזמנה ${n}`,
        html: `${orderHeader(order)}<p>בוצע זיכוי על הזמנה <strong>${n}</strong>${
          extra.refundAmount != null
            ? ` בסך <strong>${formatPrice(extra.refundAmount, order.locale, { alwaysAgorot: true })}</strong>`
            : ''
        }.</p>${extra.documentUrl ? `<p><a href="${extra.documentUrl}">למסמך הזיכוי</a></p>` : ''}${FOOTER}`,
      };
  }
}

/** מיוצא לכל מי שמרכיב HTML לדואר עם קלט משתמש (מענה לפנייה, הזמנת צוות). */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/* ------------------------------- provider --------------------------------- */

async function sendViaProvider(
  to: string,
  email: RenderedEmail,
): Promise<{ ok: boolean; id?: string; error?: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.COMMERCE_EMAIL_FROM ?? 'מכון קרן רא״ם <no-reply@keren-reem.org>';
  if (!apiKey) return { ok: false, skipped: true, error: 'RESEND_API_KEY not configured' };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject: email.subject,
      html: `<div dir="rtl" style="font-family:Arial,'Segoe UI',sans-serif;line-height:1.7">${email.html}</div>`,
    }),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok) return { ok: false, error: data.message ?? `provider ${response.status}` };
  return { ok: true, id: data.id };
}

/**
 * [1.1] מייל חופשי (לא תלוי-הזמנה) — הזמנת איש צוות, התראות תפעול.
 * אותו ספק ואותה עטיפת RTL; בלי notification_log (אין הזמנה לתלות בה).
 */
export async function sendPlainEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const result = await sendViaProvider(to, { subject, html });
  if (!result.ok && !result.skipped) {
    console.error('[commerce:notifications] plain email', result.error);
  }
  return { ok: result.ok, skipped: result.skipped, error: result.error };
}

/**
 * שליחת מייל הזמנה עם תיעוד ו-idempotency. מחזירה בשקט כשכבר נשלח.
 * ההזמנה מתנה — ההודעות תמיד למזמין; דבר אינו נשלח לנמען המתנה.
 */
export async function sendOrderEmail(
  service: SupabaseClient,
  template: EmailTemplate,
  order: Order,
  extra: Parameters<typeof renderEmail>[2] = {},
  /** סיומת מפתח לשליחה חוזרת מפורשת — עוקפת את חסימת הכפילות ביודעין */
  keySuffix?: string,
): Promise<void> {
  const recipient = order.contact_email;
  if (!recipient) return;

  const idempotencyKey = `order:${order.id}:${template}:email${keySuffix ? `:${keySuffix}` : ''}`;
  const { data: logRow, error: logError } = await service
    .from('notification_log')
    .insert({
      order_id: order.id,
      customer_id: order.user_id,
      template,
      channel: 'email',
      recipient,
      provider: 'resend',
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .maybeSingle();

  if (logError) {
    // 23505 = כבר נשלח (Webhook כפול / retry) — בדיוק ההתנהגות הרצויה
    if (logError.code !== '23505') console.error('[commerce:notify] log', logError.message);
    return;
  }
  if (!logRow) return;

  const rendered = renderEmail(template, order, extra);
  const result = await sendViaProvider(recipient, rendered);

  await service
    .from('notification_log')
    .update(
      result.ok
        ? { status: 'sent', sent_at: new Date().toISOString(), provider_message_id: result.id, attempts: 1 }
        : { status: result.skipped ? 'skipped' : 'failed', error: result.error, attempts: 1 },
    )
    .eq('id', logRow.id);

  if (!result.ok && !result.skipped) {
    console.error('[commerce:notify] send failed', template, result.error);
  }
}
