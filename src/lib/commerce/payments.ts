import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, Payment, PaymentMethod } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { getStoreSettings } from './settings';
import { createPaymentForm, isMorningConfigured } from './morning';
import { recordOrderEvent, SYSTEM_ACTOR, type Actor } from './orders';

/**
 * התחלת תשלום (תרשים 7): רשומת payment → דף תשלום במורנינג → הפניה.
 * Idempotency: מפתח פר ניסיון; ניסיון פתוח קיים עם URL בתוקף — מוחזר
 * כמות שהוא במקום לפתוח דף חדש.
 */

const PAYMENT_PAGE_TTL_MINUTES = 30;

export interface StartPaymentResult {
  ok: boolean;
  paymentUrl?: string;
  payment?: Payment;
  error?: 'not_configured' | 'morning_error' | 'db_error' | 'order_not_payable';
  errorDetail?: string;
}

export async function startPayment(
  order: Order,
  options: {
    wallet?: 'bit' | 'apple_pay' | 'google_pay' | null;
    siteUrl: string;
    /** [1.5] דריסת יעדי החזרה — לגבייה בניהול (iframe) במקום checkout/result */
    successUrl?: string;
    failureUrl?: string;
    /** [1.5] שיוך היוזמה לנציג הצוות בציר הזמן, במקום SYSTEM_ACTOR הגנרי */
    actor?: Actor;
  },
): Promise<StartPaymentResult> {
  const service = createServiceClient();
  if (!service || !isMorningConfigured()) return { ok: false, error: 'not_configured' };
  if (order.payment_state !== 'pending' && order.payment_state !== 'failed') {
    return { ok: false, error: 'order_not_payable' };
  }

  // ניסיון פתוח בתוקף — ממוחזר (רענון/לחיצה כפולה אינם פותחים דף שני)
  const { data: open } = await service
    .from('payments')
    .select('*')
    .eq('order_id', order.id)
    .eq('kind', 'charge')
    .in('status', ['initiated', 'pending'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (open?.morning_payment_page_url) {
    return { ok: true, paymentUrl: open.morning_payment_page_url, payment: open as Payment };
  }

  const settings = await getStoreSettings();
  const { count } = await service
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', order.id)
    .eq('kind', 'charge');
  const attempt = (count ?? 0) + 1;

  const expiresAt = new Date(Date.now() + PAYMENT_PAGE_TTL_MINUTES * 60_000).toISOString();
  const { data: payment, error: insertError } = await service
    .from('payments')
    .insert({
      order_id: order.id,
      kind: 'charge',
      provider: 'morning',
      method: options.wallet ?? null,
      amount: order.total,
      currency: order.currency,
      installments: 1,
      status: 'initiated',
      idempotency_key: `order:${order.id}:attempt:${attempt}`,
      expires_at: expiresAt,
    })
    .select('*')
    .maybeSingle();

  if (insertError || !payment) {
    if (insertError?.code === '23505') {
      // ניסיון מקביל הקדים אותנו — נחזיר את שלו
      const { data: raced } = await service
        .from('payments')
        .select('*')
        .eq('idempotency_key', `order:${order.id}:attempt:${attempt}`)
        .maybeSingle();
      if (raced?.morning_payment_page_url) {
        return { ok: true, paymentUrl: raced.morning_payment_page_url, payment: raced as Payment };
      }
    }
    console.error('[commerce:payments] insert', insertError?.message);
    return { ok: false, error: 'db_error' };
  }

  const { data: items } = await service
    .from('order_items')
    .select('title_snapshot, quantity, unit_price')
    .eq('order_id', order.id);

  const lines = (items ?? []).map((item) => ({
    description: item.title_snapshot ?? 'ספר',
    quantity: item.quantity,
    price: item.unit_price,
  }));
  if (order.shipping_total > 0) {
    lines.push({ description: 'משלוח', quantity: 1, price: order.shipping_total });
  }
  if (order.donation_amount > 0) {
    lines.push({ description: 'תרומה', quantity: 1, price: order.donation_amount });
  }

  const installmentsAllowed =
    !options.wallet && order.total >= settings.installments_min_total
      ? settings.installments_max
      : 1;

  const formResult = await createPaymentForm({
    amount: order.total,
    currency: order.currency,
    description: `הזמנה ${order.order_number} — מכון קרן רא״ם`,
    lines,
    client: {
      name: order.contact_name ?? '',
      email: order.contact_email ?? '',
      phone: order.contact_phone ?? '',
    },
    documentType: settings.document_type,
    vatIncluded: settings.vat_mode === 'included',
    maxInstallments: installmentsAllowed,
    preferredMethod: options.wallet ?? null,
    successUrl: options.successUrl ?? `${options.siteUrl}/checkout/result?order=${order.id}&outcome=success`,
    failureUrl: options.failureUrl ?? `${options.siteUrl}/checkout/result?order=${order.id}&outcome=failure`,
    notifyUrl: `${options.siteUrl}/api/webhooks/morning`,
    externalReference: order.id,
    lang: order.locale === 'en' ? 'en' : 'he',
  });

  if (!formResult.ok) {
    await service
      .from('payments')
      .update({ status: 'failed', error: { message: formResult.error } })
      .eq('id', payment.id);
    await recordOrderEvent(service, order.id, 'payment_failed', SYSTEM_ACTOR, {
      stage: 'create_payment_page',
      error: formResult.error,
    });
    return { ok: false, error: 'morning_error', errorDetail: formResult.error };
  }

  const { data: updated } = await service
    .from('payments')
    .update({
      status: 'pending',
      morning_transaction_id: formResult.data.transactionId,
      morning_payment_page_url: formResult.data.url,
      morning_payload: formResult.data.raw,
    })
    .eq('id', payment.id)
    .select('*')
    .maybeSingle();

  await recordOrderEvent(service, order.id, 'payment_started', options.actor ?? SYSTEM_ACTOR, {
    payment_id: payment.id,
    wallet: options.wallet ?? 'page',
    amount: order.total,
  });

  return { ok: true, paymentUrl: formResult.data.url, payment: (updated ?? payment) as Payment };
}

/** האם עסקה של מורנינג כבר שויכה — עוגן ההתאמה הכספית. */
export async function findPaymentByTransaction(
  service: SupabaseClient,
  transactionId: string,
): Promise<Payment | null> {
  const { data } = await service
    .from('payments')
    .select('*')
    .eq('morning_transaction_id', transactionId)
    .maybeSingle();
  return (data as Payment | null) ?? null;
}

export async function markPaymentSucceeded(
  service: SupabaseClient,
  paymentId: string,
  method: PaymentMethod | null,
): Promise<void> {
  const patch: Record<string, unknown> = { status: 'succeeded' };
  if (method) patch.method = method;
  const { error } = await service.from('payments').update(patch).eq('id', paymentId);
  if (error) console.error('[commerce:payments] mark succeeded', error.message);
}

export async function markPaymentFailed(
  service: SupabaseClient,
  paymentId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  const { error } = await service
    .from('payments')
    .update({ status: 'failed', error: detail })
    .eq('id', paymentId);
  if (error) console.error('[commerce:payments] mark failed', error.message);
}
