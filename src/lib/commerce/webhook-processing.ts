import 'server-only';
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, PaymentMethod } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyWebhookSignature, normalizeStatusPayload, getTransactionStatus } from './morning';
import { findPaymentByTransaction, markPaymentFailed, markPaymentSucceeded } from './payments';
import { transitionOrder, recordOrderEvent, MORNING_ACTOR, SYSTEM_ACTOR } from './orders';
import { commitStock, releaseStock } from './inventory';
import { recordDocument } from './documents';
import { sendOrderEmail } from './notifications';
import { getStoreSettings } from './settings';
import { formatPromisedDate } from './delivery-date';
import { round2 } from './pricing';

/**
 * עיבוד התראות מורנינג — תרשים 8 במלואו:
 * שמירת גולמי → חתימה → כפילות → התאמה → אימות סכום → טרנזקציית מצב
 * (תשלום, מלאי, מסמך) → מיילים → תיעוד. ההפניה חזרה מהסליקה לעולם אינה
 * מקור אמת — רק הנתיב הזה (וה-Polling המגבה) משנה payment_state.
 */

export interface WebhookOutcome {
  status: 'processed' | 'duplicate' | 'invalid_signature' | 'unmatched' | 'amount_mismatch' | 'error';
  httpStatus: number;
}

/** [1.1] תקרת גודל לשמירת payload גולמי (סעיף 8 בסבב התיקונים). */
const MAX_RAW_PAYLOAD_BYTES = 256 * 1024;

/** שדות רגישים שמוסרים מה-payload לפני השמירה — אינם נחוצים לעיבוד. */
const REDACTED_KEYS = new Set([
  'client', 'customer', 'payer', 'card', 'creditCard', 'cardNumber', 'pan',
  'cvv', 'expiry', 'address', 'billingAddress', 'shippingAddress', 'emails',
  'phone', 'email', 'taxId', 'idNumber',
]);

/**
 * צמצום רקורסיבי: שדה רגיש מוחלף ב-"[redacted]"; "מסתיים ב-1234"
 * (last4/lastDigits) נשאר — זה כל מה שמותר לשמור מאמצעי התשלום.
 * ה-dedupe_hash מחושב על הגוף *לפני* הצמצום — ה-idempotency לא נשבר.
 */
function redactPayload(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => redactPayload(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.has(key) ? '[redacted]' : redactPayload(val, depth + 1);
  }
  return out;
}

export async function processMorningWebhook(
  rawBody: string,
  headers: Headers,
): Promise<WebhookOutcome> {
  const service = createServiceClient();
  if (!service) return { status: 'error', httpStatus: 500 };

  const signatureValid = verifyWebhookSignature(rawBody, headers);
  const payload = safeParse(rawBody);
  const dedupeHash = createHash('sha256').update(rawBody).digest('hex');
  const externalEventId =
    typeof payload?.eventId === 'string' ? payload.eventId : null;
  const rawBytes = Buffer.byteLength(rawBody, 'utf8');
  const oversized = rawBytes > MAX_RAW_PAYLOAD_BYTES;

  // [1.1] מה נשמר (מדיניות פרק 8.6):
  //   חתימה תקינה → payload מצומצם + שדות מנורמלים (הגולמי המלא אינו נשמר
  //   לעולם — צמצום שדות רגישים לפני הכתיבה, hash-הכפילות חושב קודם);
  //   חתימה שגויה → אין payload בכלל: hash, אורך ומקור בלבד (ערוץ הצפה זול);
  //   גוף חורג מהתקרה → כנ"ל, עם payload_truncated.
  const normalized = signatureValid && payload ? normalizeStatusPayload(payload) : null;
  const storedPayload =
    !signatureValid || oversized
      ? {
          hash: dedupeHash,
          bytes: rawBytes,
          source_ip: headers.get('x-forwarded-for') ?? null,
          user_agent: headers.get('user-agent')?.slice(0, 200) ?? null,
        }
      : ((redactPayload(payload) as Record<string, unknown>) ?? { raw: rawBody.slice(0, 10_000) });

  const { data: eventRow, error: insertError } = await service
    .from('webhook_events')
    .insert({
      provider: 'morning',
      event_type: typeof payload?.type === 'string' ? payload.type : null,
      external_event_id: externalEventId,
      dedupe_hash: dedupeHash,
      signature_valid: signatureValid,
      payload: storedPayload,
      payload_normalized: normalized
        ? {
            status: normalized.status,
            amount: normalized.amount,
            method: normalized.method,
            transaction_id:
              (typeof payload?.transactionId === 'string' && payload.transactionId) ||
              (typeof payload?.id === 'string' && payload.id) ||
              null,
            document_id: (payload?.documentId as string) ?? null,
          }
        : null,
      payload_truncated: oversized,
      processing_status: signatureValid ? 'received' : 'invalid_signature',
    })
    .select('id')
    .maybeSingle();

  if (insertError) {
    if (insertError.code === '23505') {
      // אירוע עם אותו hash כבר קיים. "כפול → 200 בלי עיבוד" נכון רק
      // כשהמקור כבר עובד בהצלחה. שני מקרים אחרים חייבים עיבוד חוזר:
      //  • השורה נתקעה ב-received/failed — קריסה באמצע העיבוד הקודם
      //    החזירה 500, מורנינג שולחת שוב את אותו גוף, ובלי זה האירוע
      //    היה אבוד לתמיד (ההתאוששות היחידה הייתה ה-cron היומי).
      //  • השורה נרשמה עם חתימה שגויה (ניסיון הרעלה של מפתח הכפילות) —
      //    האירוע האמיתי החתום לא ייתן לה לחסום אותו.
      if (signatureValid) {
        const { data: existing } = await service
          .from('webhook_events')
          .select('id, processing_status')
          .eq('provider', 'morning')
          .eq('dedupe_hash', dedupeHash)
          .maybeSingle();
        if (existing && existing.processing_status !== 'processed') {
          await service
            .from('webhook_events')
            .update({ signature_valid: true, processing_status: 'received' })
            .eq('id', existing.id);
          return runProcessing(service, payload ?? {}, existing.id);
        }
      }
      return { status: 'duplicate', httpStatus: 200 };
    }
    console.error('[commerce:webhook] store', insertError.message);
    return { status: 'error', httpStatus: 500 };
  }
  if (!signatureValid) return { status: 'invalid_signature', httpStatus: 401 };

  return runProcessing(service, payload ?? {}, eventRow?.id ?? null);
}

/**
 * עטיפת העיבוד בטיפול בחריגות: בלי זה, חריגה באמצע העיבוד מחזירה 500
 * כשהשורה כבר נכתבה כ-received — הניסיון החוזר של מורנינג פוגע במפתח
 * הכפילות, מקבל 200, והאירוע נתקע ב-received לנצח. סימון failed משאיר
 * אותו גלוי בדוח ה-webhooks וניתן לעיבוד חוזר דרך מסלול הכפילות למעלה.
 */
async function runProcessing(
  service: SupabaseClient,
  payload: Record<string, unknown>,
  eventId: string | null,
): Promise<WebhookOutcome> {
  try {
    return await applyTransactionUpdate(service, payload, eventId);
  } catch (error) {
    console.error('[commerce:webhook] processing crashed', error);
    await finalizeEvent(service, eventId, 'failed', error instanceof Error ? error.message : 'crash');
    return { status: 'error', httpStatus: 500 };
  }
}

/**
 * [1.1] טיהור payload גולמי מאירועים מעובדים בני 90 יום ומעלה — נשארים
 * השדות המנורמלים והמזהים. אירועי failed מוחרגים עד סגירת החקירה.
 */
export async function purgeOldWebhookPayloads(retentionDays = 90): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000).toISOString();
  const { data, error } = await service
    .from('webhook_events')
    .update({ payload: {}, raw_purged_at: new Date().toISOString() })
    .in('processing_status', ['processed', 'duplicate', 'invalid_signature'])
    .is('raw_purged_at', null)
    .lt('received_at', cutoff)
    .select('id');
  if (error) {
    console.error('[commerce:webhook] purge', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

async function applyTransactionUpdate(
  service: SupabaseClient,
  payload: Record<string, unknown>,
  webhookEventId: string | null,
): Promise<WebhookOutcome> {
  const normalized = normalizeStatusPayload(payload);
  const externalReference =
    (typeof payload.custom === 'string' && payload.custom) ||
    (typeof payload.externalReference === 'string' && payload.externalReference) ||
    null;
  const transactionId =
    (typeof payload.transactionId === 'string' && payload.transactionId) ||
    (typeof payload.id === 'string' && payload.id) ||
    null;

  // התאמה: לפי מזהה העסקה, ואם אין — לפי מזהה ההזמנה שב-custom
  let payment = transactionId ? await findPaymentByTransaction(service, transactionId) : null;
  let order: Order | null = null;

  if (!payment && externalReference) {
    const { data } = await service
      .from('payments')
      .select('*')
      .eq('order_id', externalReference)
      .eq('kind', 'charge')
      .in('status', ['initiated', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    payment = data ?? null;
  }
  if (payment) {
    const { data } = await service.from('orders').select('*').eq('id', payment.order_id).maybeSingle();
    order = (data as Order | null) ?? null;
  }

  if (!payment || !order) {
    await finalizeEvent(service, webhookEventId, 'failed', 'unmatched transaction');
    console.error('[commerce:webhook] unmatched', { transactionId, externalReference });
    return { status: 'unmatched', httpStatus: 200 };
  }

  await service
    .from('webhook_events')
    .update({ order_id: order.id, payment_id: payment.id })
    .eq('id', webhookEventId ?? '');

  if (normalized.status === 'paid') {
    // אימות סכום מול הצילום — פער עוצר אישור אוטומטי ומסמן חריגה
    if (normalized.amount != null && round2(normalized.amount) !== round2(order.total)) {
      await recordOrderEvent(service, order.id, 'webhook_amount_mismatch', MORNING_ACTOR, {
        expected: order.total,
        received: normalized.amount,
      });
      await service
        .from('orders')
        .update({ tags: [...new Set([...(order.tags ?? []), 'amount-mismatch'])] })
        .eq('id', order.id);
      await finalizeEvent(service, webhookEventId, 'failed', 'amount mismatch');
      return { status: 'amount_mismatch', httpStatus: 200 };
    }
    await handlePaymentSucceeded(service, order, payment.id, normalized.method, payload);
  } else if (normalized.status === 'failed') {
    await handlePaymentFailed(service, order, payment.id, payload);
  } else {
    // pending/unknown — נרשם, בלי שינוי מצב
    await recordOrderEvent(service, order.id, 'webhook_received', MORNING_ACTOR, {
      status: normalized.status,
    });
  }

  await finalizeEvent(service, webhookEventId, 'processed', null);
  return { status: 'processed', httpStatus: 200 };
}

async function handlePaymentSucceeded(
  service: SupabaseClient,
  order: Order,
  paymentId: string,
  method: PaymentMethod | null,
  payload: Record<string, unknown>,
): Promise<void> {
  await markPaymentSucceeded(service, paymentId, method);

  const paymentTransition = await transitionOrder(service, order.id, 'payment_state', 'paid', MORNING_ACTOR, {
    payment_id: paymentId,
    method,
  });
  // כבר paid (אירוע כפול שחמק מה-dedupe) — לא ממשיכים להפחתה כפולה;
  // ההפחתה עצמה ממילא idempotent במסד
  const firstTime = paymentTransition.ok;
  await transitionOrder(service, order.id, 'state', 'confirmed', MORNING_ACTOR);
  await recordOrderEvent(service, order.id, 'payment_succeeded', MORNING_ACTOR, { method });

  // הפחתת מלאי: reserve → sale (idempotent פר פריט)
  const { data: items } = await service
    .from('order_items')
    .select('book_id, quantity, is_preorder')
    .eq('order_id', order.id);
  for (const item of items ?? []) {
    if (!item.book_id || item.is_preorder) continue;
    await commitStock(service, item.book_id, item.quantity, order.id);
  }

  // מסמך: אם ההתראה נושאת פרטי מסמך — נרשם; אחרת ממתין (Retry/Polling)
  const settings = await getStoreSettings();
  const docId = (payload.documentId as string) ?? null;
  const docNumber = (payload.documentNumber as string) ?? null;
  const docUrl = (payload.documentUrl as string) ?? null;
  if (docId || docNumber) {
    await recordDocument(service, order, {
      docType: settings.document_type,
      morningDocId: docId,
      docNumber,
      amount: order.total,
      downloadUrl: docUrl,
      paymentId,
    });
  } else {
    await transitionOrder(service, order.id, 'document_state', 'pending', SYSTEM_ACTOR);
  }

  if (firstTime) {
    const fresh = { ...order, payment_state: 'paid' as const };
    const promised = order.promised_delivery_date
      ? formatPromisedDate(new Date(order.promised_delivery_date), order.locale)
      : null;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    await sendOrderEmail(service, 'payment_received', fresh, {
      documentUrl: docUrl,
      promisedDateLabel: promised,
      trackUrl: order.guest_token_hash ? undefined : `${siteUrl}/account/orders/${order.order_number}`,
    });
  }
}

async function handlePaymentFailed(
  service: SupabaseClient,
  order: Order,
  paymentId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await markPaymentFailed(service, paymentId, { webhook: true, raw: payload });
  await transitionOrder(service, order.id, 'payment_state', 'failed', MORNING_ACTOR);
  await recordOrderEvent(service, order.id, 'payment_failed', MORNING_ACTOR, {});
  await sendOrderEmail(service, 'payment_failed', order, {});
}

async function finalizeEvent(
  service: SupabaseClient,
  eventId: string | null,
  status: 'processed' | 'failed',
  error: string | null,
): Promise<void> {
  if (!eventId) return;
  await service
    .from('webhook_events')
    .update({ processing_status: status, processed_at: new Date().toISOString(), error })
    .eq('id', eventId);
}

/**
 * גיבוי ל-Webhook שלא הגיע (הנחה A8, תרשים 19): סריקת payments תלויים
 * ושאילת מורנינג יזומה. מופעל מ-cron; אותה לוגיקת עיבוד בדיוק.
 */
export async function pollPendingPayments(olderThanMinutes: number = 10): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000).toISOString();
  const { data: pending } = await service
    .from('payments')
    .select('*')
    .eq('kind', 'charge')
    .eq('status', 'pending')
    .lt('created_at', cutoff)
    .limit(20);

  let updates = 0;
  for (const payment of pending ?? []) {
    const statusResult = await getTransactionStatus(payment.order_id);
    if (!statusResult.ok) continue;
    if (statusResult.data.status === 'pending' || statusResult.data.status === 'unknown') continue;

    const { data: order } = await service
      .from('orders')
      .select('*')
      .eq('id', payment.order_id)
      .maybeSingle();
    if (!order) continue;

    if (statusResult.data.status === 'paid') {
      await handlePaymentSucceeded(
        service,
        order as Order,
        payment.id,
        statusResult.data.method,
        statusResult.data.raw,
      );
    } else {
      await handlePaymentFailed(service, order as Order, payment.id, statusResult.data.raw);
    }
    updates += 1;
  }
  return updates;
}

/** שחרור שמירות מלאי של הזמנות שתשלומן פג — job תקופתי. */
export async function releaseExpiredReservations(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const { data: expired } = await service
    .from('payments')
    .select('id, order_id')
    .eq('kind', 'charge')
    .in('status', ['initiated', 'pending'])
    .lt('expires_at', new Date().toISOString())
    .limit(50);

  let released = 0;
  for (const payment of expired ?? []) {
    await service.from('payments').update({ status: 'expired' }).eq('id', payment.id);
    const { data: items } = await service
      .from('order_items')
      .select('book_id, quantity')
      .eq('order_id', payment.order_id);
    for (const item of items ?? []) {
      if (!item.book_id) continue;
      await releaseStock(service, item.book_id, item.quantity, payment.order_id);
    }
    await recordOrderEvent(service, payment.order_id, 'stock_released', SYSTEM_ACTOR, {
      reason: 'payment_expired',
    });
    released += 1;
  }
  return released;
}

function safeParse(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
