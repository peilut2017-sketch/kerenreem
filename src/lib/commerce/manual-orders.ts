import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { validateCart } from './cart';
import { computeTotals } from './checkout';
import { getStoreSettings } from './settings';
import { getAvailableMethods } from './shipping';
import { getPromisedDate } from './delivery-date';
import { generateGuestToken } from './guest-token';
import { normalizePhone, isValidIsraeliPhone } from './phone';
import { recordOrderEvent, type Actor } from './orders';
import { reserveStock, releaseStock } from './inventory';
import type { Order, ShippingAddress } from '@/lib/supabase/types';

/**
 * הזמנה ידנית — ערוץ הטלפון (פרק 9.6, תרשים 6): איש צוות קולט הזמנה
 * בשיחה, בוחר ספרים, ממלא פרטי קשר ואספקה — וההזמנה נוצרת עם אותו צילום
 * מלא, אותה שמירת מלאי ואותו טוקן מעקב כמו הזמנת אתר. ההמשך משם זהה:
 * קישור תשלום מורנינג במייל, או סימון תשלום חיצוני (העברה/מזומן בחנות).
 * המחירים תמיד מהקטלוג דרך validateCart — הצוות אינו מקליד מחירים.
 */

export interface ManualOrderInput {
  items: { bookId: string; quantity: number }[];
  contact: { name: string; phone: string; email: string | null };
  fulfillment:
    | { type: 'pickup' }
    | { type: 'shipping'; methodId: string; address: ShippingAddress };
  note: string | null;
  locale: string;
  actor: Actor;
}

export interface ManualOrderResult {
  ok: boolean;
  order?: Order;
  guestToken?: string;
  error?: string;
}

export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד (SUPABASE_SERVICE_ROLE_KEY חסר)' };

  const name = input.contact.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: 'שם הלקוח חסר' };
  if (!isValidIsraeliPhone(input.contact.phone)) return { ok: false, error: 'מספר טלפון לא תקין' };
  const email = input.contact.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'כתובת מייל לא תקינה' };
  }

  const cart = await validateCart(input.items, input.locale);
  const activeLines = cart.lines.filter((line) => line.removedReason === null && line.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: 'לא נבחרו פריטים זמינים' };
  const unavailable = cart.lines.filter((line) => line.removedReason !== null);
  if (unavailable.length > 0) {
    return { ok: false, error: `פריטים לא זמינים: ${unavailable.map((l) => l.title).join(', ')}` };
  }

  const settings = await getStoreSettings();
  const shape = {
    subtotal: cart.subtotal,
    totalWeightGrams: cart.totalWeightGrams,
    freeShippingEligible: cart.freeShippingEligible,
  };

  // שיטת אספקה + מחיר — מאותו מנוע בדיוק כמו ה-Checkout
  let shippingMethod: { id: string | null; name: string; isPickup: boolean };
  let shippingPrice = 0;
  let etaDays = 0;
  let address: ShippingAddress | null = null;

  const fulfillment = input.fulfillment;
  if (fulfillment.type === 'pickup') {
    shippingMethod = { id: null, name: 'איסוף עצמי', isPickup: true };
  } else {
    const methods = await getAvailableMethods(shape, settings);
    const chosen = methods.find(({ method }) => method.id === fulfillment.methodId);
    if (!chosen || chosen.method.kind === 'pickup') {
      return { ok: false, error: 'שיטת המשלוח שנבחרה אינה זמינה להזמנה הזו' };
    }
    shippingMethod = { id: chosen.method.id, name: chosen.method.name_he, isPickup: false };
    shippingPrice = chosen.price;
    etaDays = chosen.method.eta_business_days;
    address = fulfillment.address;
    if (!fulfillment.address.city?.trim() || !fulfillment.address.street?.trim()) {
      return { ok: false, error: 'כתובת משלוח חסרה (עיר ורחוב לפחות)' };
    }
  }

  const totals = computeTotals(cart, shippingPrice, settings, 0, 0);
  const promised =
    input.fulfillment.type === 'pickup'
      ? null
      : getPromisedDate({ settings, etaBusinessDays: etaDays, prepDaysOverride: cart.maxPrepDays })
          .toISOString()
          .slice(0, 10);

  const { token, hash } = generateGuestToken();
  const guestExpiry = new Date();
  guestExpiry.setDate(guestExpiry.getDate() + 90);

  // [1.1] צילום עלות — כמו בהזמנת אתר (דוחות הרווחיות 17.14)
  const { data: costRows } = await service
    .from('book_costs')
    .select('book_id, cost_price')
    .in('book_id', activeLines.map((line) => line.bookId));
  const costByBook = new Map((costRows ?? []).map((row) => [row.book_id, Number(row.cost_price)]));

  const { data: order, error: orderError } = await service
    .from('orders')
    .insert({
      user_id: null,
      state: 'pending',
      payment_state: 'pending',
      fulfillment_state: 'unfulfilled',
      document_state: 'not_created',
      channel: 'phone',
      locale: input.locale,
      subtotal: totals.subtotal,
      discount_total: totals.discountTotal,
      shipping_total: totals.shippingTotal,
      donation_amount: 0,
      tax_total: totals.taxTotal,
      total: totals.total,
      currency: 'ILS',
      fulfillment_type: input.fulfillment.type,
      shipping_method_id: shippingMethod.id,
      shipping_method_name_snapshot: shippingMethod.name,
      promised_delivery_date: promised,
      shipping_address: address,
      guest_token_hash: hash,
      guest_token_expires_at: guestExpiry.toISOString(),
      contact_name: name,
      contact_email: email,
      contact_phone: normalizePhone(input.contact.phone),
      notes: input.note?.trim().slice(0, 1000) || null,
      placed_at: new Date().toISOString(),
      idempotency_key: `manual:${token.slice(0, 24)}`,
    })
    .select('*')
    .maybeSingle();
  if (orderError || !order) {
    return { ok: false, error: orderError?.message ?? 'יצירת ההזמנה נכשלה' };
  }

  const { error: itemsError } = await service.from('order_items').insert(
    activeLines.map((line) => ({
      order_id: order.id,
      book_id: line.bookId,
      title_snapshot: line.title,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      unit_price_original: line.originalUnitPrice,
      discount_amount: 0,
      tax_rate_snapshot: settings.vat_mode === 'included' ? settings.vat_rate : 0,
      line_total: line.lineTotal,
      is_preorder: line.isPreorder,
      cost_price_snapshot: costByBook.get(line.bookId) ?? null,
    })),
  );
  if (itemsError) {
    await service.from('orders').update({ state: 'cancelled' }).eq('id', order.id);
    return { ok: false, error: itemsError.message };
  }

  // שמירת מלאי — אותה זרימה כמו הזמנת אתר; כשל באמצע משחרר ומבטל
  const reserved: { bookId: string; quantity: number }[] = [];
  for (const line of activeLines) {
    if (line.availableQuantity === null || line.isPreorder) continue;
    const result = await reserveStock(service, line.bookId, line.quantity, order.id);
    if (!result.ok) {
      for (const done of reserved) await releaseStock(service, done.bookId, done.quantity, order.id);
      await service.from('orders').update({ state: 'cancelled' }).eq('id', order.id);
      return { ok: false, error: `אזל מהמלאי תוך כדי: ${line.title}` };
    }
    reserved.push({ bookId: line.bookId, quantity: line.quantity });
  }

  await recordOrderEvent(service, order.id, 'order_created', input.actor, {
    channel: 'phone',
    items: activeLines.length,
  });

  return { ok: true, order: order as Order, guestToken: token };
}
