import 'server-only';
import type {
  CheckoutSessionRecord,
  Order,
  ShippingAddress,
  StoreSettings,
} from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { round2 } from './pricing';
import type { ValidatedCart } from './cart';
import { generateGuestToken } from './guest-token';
import { recordOrderEvent, SYSTEM_ACTOR, type Actor } from './orders';
import { releaseStock, reserveStock } from './inventory';

/**
 * ליבת ה-Checkout: חישוב הסכומים בשרת בלבד, ויצירת ההזמנה עם צילום מלא
 * (תרשים 6 ב-commerce-flows). הדפדפן שולח כוונות; הסכום המחייב מחושב
 * כאן מול books, ומושווה למה שהוצג ללקוח — פער עוצר את התהליך במקום
 * לחייב סכום שהלקוח לא ראה.
 */

export interface Totals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  donationAmount: number;
  /** רכיב המע"מ בתוך הסכום (אינפורמטיבי כש-vat_mode=included) */
  taxTotal: number;
  total: number;
}

export function computeTotals(
  cart: ValidatedCart,
  shippingPrice: number,
  settings: Pick<StoreSettings, 'vat_mode' | 'vat_rate'>,
  donation: number = 0,
  couponDiscount: number = 0,
): Totals {
  const subtotal = cart.subtotal;
  const discountTotal = round2(Math.min(Math.max(couponDiscount, 0), subtotal));
  const shippingTotal = round2(shippingPrice);
  const donationAmount = round2(Math.max(donation, 0));
  const total = round2(subtotal - discountTotal + shippingTotal + donationAmount);
  const taxTotal =
    settings.vat_mode === 'included'
      ? round2(((subtotal - discountTotal + shippingTotal) * settings.vat_rate) / (100 + settings.vat_rate))
      : 0;
  return { subtotal, discountTotal, shippingTotal, donationAmount, taxTotal, total };
}

/* ------------------------------- session ---------------------------------- */

export async function loadSession(sessionId: string): Promise<CheckoutSessionRecord | null> {
  const service = createServiceClient();
  if (!service) return null;
  const { data, error } = await service
    .from('checkout_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) console.error('[commerce:checkout] load session', error.message);
  return (data as CheckoutSessionRecord | null) ?? null;
}

export async function createSession(
  input: Partial<CheckoutSessionRecord> & { items: { book_id: string; quantity: number }[] },
): Promise<CheckoutSessionRecord | null> {
  const service = createServiceClient();
  if (!service) return null;
  const { data, error } = await service
    .from('checkout_sessions')
    .insert({
      items: input.items,
      customer_id: input.customer_id ?? null,
      locale: input.locale ?? 'he',
      is_express: input.is_express ?? false,
      express_wallet: input.express_wallet ?? null,
      idempotency_key: crypto.randomUUID(),
    })
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[commerce:checkout] create session', error.message);
    return null;
  }
  return data as CheckoutSessionRecord;
}

export async function updateSession(
  sessionId: string,
  patch: Partial<CheckoutSessionRecord>,
): Promise<CheckoutSessionRecord | null> {
  const service = createServiceClient();
  if (!service) return null;
  const { data, error } = await service
    .from('checkout_sessions')
    .update(patch)
    .eq('id', sessionId)
    .select('*')
    .maybeSingle();
  if (error) {
    console.error('[commerce:checkout] update session', error.message);
    return null;
  }
  return data as CheckoutSessionRecord;
}

/* ----------------------------- order creation ----------------------------- */

export interface CreateOrderInput {
  session: CheckoutSessionRecord;
  cart: ValidatedCart;
  totals: Totals;
  shippingMethod: { id: string | null; name: string; isPickup: boolean } | null;
  promisedDeliveryDate: string | null;
  address: ShippingAddress | null;
  taxRate: number;
  coupon?: { id: string; code: string } | null;
  actor?: Actor;
}

export interface CreateOrderResult {
  ok: boolean;
  order?: Order;
  guestToken?: string;
  error?: 'unavailable' | 'insufficient_stock' | 'db_error' | 'not_configured';
  failedBookIds?: string[];
}

/**
 * יצירת הזמנה pending עם צילום מלא + שמירת מלאי. Idempotent לפי מפתח
 * ה-session: קריאה חוזרת מחזירה את ההזמנה הקיימת בלי ליצור דבר.
 *
 * הערת אטומיות: Supabase JS אינו חושף טרנזקציה מרובת-פקודות; הבטיחות
 * מגיעה מה-idempotency במסד ומאטומיות ה-reserve הפר-פריטי — כשל שמירה
 * באמצע משחרר את מה שנשמר ומסמן את ההזמנה cancelled, ולעולם אינו משאיר
 * שמירה יתומה או מכירת יתר.
 */
export async function createOrderFromSession(input: CreateOrderInput): Promise<CreateOrderResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'not_configured' };

  const { session, cart, totals } = input;
  const actor = input.actor ?? SYSTEM_ACTOR;

  // Idempotency: הזמנה קיימת עם מפתח ה-session — מוחזרת כמות שהיא
  const { data: existing } = await service
    .from('orders')
    .select('*')
    .eq('idempotency_key', session.idempotency_key)
    .maybeSingle();
  if (existing) return { ok: true, order: existing as Order };

  const activeLines = cart.lines.filter((line) => line.removedReason === null && line.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: 'unavailable' };

  const { token, hash } = generateGuestToken();
  const guestExpiry = new Date();
  guestExpiry.setDate(guestExpiry.getDate() + 90);

  const insertPayload = {
    user_id: session.customer_id,
    state: 'pending',
    payment_state: 'pending',
    fulfillment_state: 'unfulfilled',
    document_state: 'not_created',
    channel: session.is_express ? 'web' : 'web',
    locale: session.locale,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    shipping_total: totals.shippingTotal,
    donation_amount: totals.donationAmount,
    tax_total: totals.taxTotal,
    total: totals.total,
    currency: 'ILS',
    coupon_id: input.coupon?.id ?? null,
    coupon_code_snapshot: input.coupon?.code ?? null,
    fulfillment_type: input.shippingMethod?.isPickup ? 'pickup' : 'shipping',
    shipping_method_id: input.shippingMethod?.id ?? null,
    shipping_method_name_snapshot: input.shippingMethod?.name ?? null,
    promised_delivery_date: input.promisedDeliveryDate,
    shipping_address: input.address,
    courier_notes: input.session.fulfillment?.courier_notes ?? null,
    is_gift: session.is_gift,
    gift_recipient_name: session.gift_recipient_name,
    gift_message: session.gift_message,
    gift_hide_prices: session.gift_hide_prices,
    guest_token_hash: hash,
    guest_token_expires_at: guestExpiry.toISOString(),
    contact_name: session.contact_name,
    contact_email: session.contact_email,
    contact_phone: session.contact_phone,
    placed_at: new Date().toISOString(),
    idempotency_key: session.idempotency_key,
  };

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert(insertPayload)
    .select('*')
    .maybeSingle();

  if (orderError) {
    // התנגשות idempotency: לחיצה כפולה שהקדימה אותנו — מחזירים את הקיימת
    if (orderError.code === '23505') {
      const { data: raced } = await service
        .from('orders')
        .select('*')
        .eq('idempotency_key', session.idempotency_key)
        .maybeSingle();
      if (raced) return { ok: true, order: raced as Order };
    }
    console.error('[commerce:checkout] order insert', orderError.message);
    return { ok: false, error: 'db_error' };
  }
  if (!order) return { ok: false, error: 'db_error' };

  const itemsPayload = activeLines.map((line) => ({
    order_id: order.id,
    book_id: line.bookId,
    title_snapshot: line.title,
    sku_snapshot: null,
    quantity: line.quantity,
    unit_price: line.unitPrice,
    unit_price_original: line.originalUnitPrice,
    discount_amount: 0,
    tax_rate_snapshot: input.taxRate,
    line_total: line.lineTotal,
    is_preorder: line.isPreorder,
  }));

  const { error: itemsError } = await service.from('order_items').insert(itemsPayload);
  if (itemsError) {
    console.error('[commerce:checkout] items insert', itemsError.message);
    await service.from('orders').update({ state: 'cancelled' }).eq('id', order.id);
    return { ok: false, error: 'db_error' };
  }

  // שמירת מלאי אטומית פר פריט (תרשים 10); כשל — שחרור מלא וביטול
  const reserved: { bookId: string; quantity: number }[] = [];
  for (const line of activeLines) {
    // availableQuantity=null פירושו מלאי בלתי-מנוהל; הזמנה מוקדמת אינה שומרת
    if (line.availableQuantity === null || line.isPreorder) continue;
    const result = await reserveStock(service, line.bookId, line.quantity, order.id);
    if (!result.ok) {
      for (const done of reserved) {
        await releaseStock(service, done.bookId, done.quantity, order.id);
      }
      await service.from('orders').update({ state: 'cancelled' }).eq('id', order.id);
      await recordOrderEvent(service, order.id, 'cancelled', SYSTEM_ACTOR, {
        reason: 'insufficient_stock',
        book_id: line.bookId,
      });
      return { ok: false, error: 'insufficient_stock', failedBookIds: [line.bookId] };
    }
    reserved.push({ bookId: line.bookId, quantity: line.quantity });
  }

  await recordOrderEvent(service, order.id, 'order_created', actor, {
    order_number: order.order_number,
    total: totals.total,
    items: activeLines.length,
    express: session.is_express,
  });

  await service
    .from('checkout_sessions')
    .update({ status: 'converted', order_id: order.id })
    .eq('id', session.id);

  return { ok: true, order: order as Order, guestToken: token };
}
