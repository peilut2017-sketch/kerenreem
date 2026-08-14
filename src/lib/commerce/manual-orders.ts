import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { validateCart, type ValidatedCart } from './cart';
import { computeTotals, type Totals } from './checkout';
import { getStoreSettings } from './settings';
import { getAvailableMethods } from './shipping';
import { getPromisedDate } from './delivery-date';
import { generateGuestToken } from './guest-token';
import { normalizePhone, isValidIsraeliPhone } from './phone';
import { recordOrderEvent, type Actor } from './orders';
import { reserveStock, releaseStock } from './inventory';
import { validateCoupon, recordRedemption, type CouponError } from './coupons';
import { findBestPromotion } from './promotions';
import type { Order, ShippingAddress, StoreSettings } from '@/lib/supabase/types';

/**
 * הזמנה ידנית — ערוץ הטלפון (פרק 9.6, תרשים 6): איש צוות קולט הזמנה
 * בשיחה, בוחר ספרים, ממלא פרטי קשר ואספקה — וההזמנה נוצרת עם אותו צילום
 * מלא, אותה שמירת מלאי ואותו טוקן מעקב כמו הזמנת אתר. ההמשך משם זהה:
 * קישור תשלום מורנינג במייל, או סימון תשלום חיצוני (העברה/מזומן בחנות).
 * המחירים תמיד מהקטלוג דרך validateCart. [1.9] חריג יחיד: ספר בלי מחיר
 * קטלוגי (price null) — הצוות יכול להקליד מחיר לפריט הזה בלבד
 * (manualUnitPrice/priceOverrides ב-validateCart), ולעולם לא כדריסה של
 * מחיר קטלוגי קיים.
 *
 * [1.5] "משלוח חינם לא מחושב, אי אפשר להזין קופון" — resolvePricing הוא
 * מקור אמת יחיד למחיר משלוח+קופון+מבצע אוטומטי, בשימוש הן לתצוגה החיה
 * בטופס (previewManualOrderTotals) והן ליצירת ההזמנה בפועל (createManualOrder),
 * כדי שמה שהנציג מקריא ללקוח = מה שנגבה. אותו עקרון בדיוק כמו getEffectivePrice
 * למחיר ספר בודד (סבב 1.4, פריט קריטי 24).
 */

export interface ManualOrderFulfillment {
  type: 'pickup' | 'shipping';
  methodId?: string;
  address?: ShippingAddress;
}

interface PricingResolution {
  ok: boolean;
  error?: string;
  shippingMethod: { id: string | null; name: string; isPickup: boolean } | null;
  shippingPrice: number;
  etaDays: number;
  totals: Totals;
  coupon: { id: string; code: string } | null;
  couponError: CouponError | null;
  /** חלק ההנחה של הקופון בלבד — לרישום המימוש (בלי הנחת המבצע האוטומטי) */
  couponDiscount: number;
  promotionId: string | null;
  promotionName: string | null;
}

async function resolvePricing(
  cart: ValidatedCart,
  fulfillment: ManualOrderFulfillment,
  settings: StoreSettings,
  couponCode: string | null,
  contactPhone: string | null,
  contactEmail: string | null,
): Promise<PricingResolution> {
  const shape = {
    subtotal: cart.subtotal,
    totalWeightGrams: cart.totalWeightGrams,
    freeShippingEligible: cart.freeShippingEligible,
  };

  let shippingMethod: { id: string | null; name: string; isPickup: boolean };
  let basePrice = 0;
  let etaDays = 0;

  if (fulfillment.type === 'pickup') {
    shippingMethod = { id: null, name: 'איסוף עצמי', isPickup: true };
  } else {
    const methods = await getAvailableMethods(shape, settings);
    const chosen = methods.find(({ method }) => method.id === fulfillment.methodId);
    if (!chosen || chosen.method.kind === 'pickup') {
      return {
        ok: false,
        error: 'שיטת המשלוח שנבחרה אינה זמינה להזמנה הזו',
        shippingMethod: null,
        shippingPrice: 0,
        etaDays: 0,
        totals: computeTotals(cart, 0, settings),
        coupon: null,
        couponError: null,
        couponDiscount: 0,
        promotionId: null,
        promotionName: null,
      };
    }
    shippingMethod = { id: chosen.method.id, name: chosen.method.name_he, isPickup: false };
    basePrice = chosen.price;
    etaDays = chosen.method.eta_business_days;
  }

  // קופון — אותו אימות שרתי בדיוק כמו ב-Checkout הציבורי
  let coupon: { id: string; code: string } | null = null;
  let couponError: CouponError | null = null;
  let couponDiscount = 0;
  let couponFreeShipping = false;
  if (couponCode?.trim()) {
    const result = await validateCoupon(couponCode, cart, contactPhone, contactEmail);
    if (result.ok && result.coupon) {
      coupon = { id: result.coupon.id, code: result.coupon.code };
      couponDiscount = result.discountAmount;
      couponFreeShipping = result.freeShipping;
    } else {
      couponError = result.error ?? 'invalid';
    }
  }

  // מבצע אוטומטי — אותו כלל כמו בעגלה: לא נערם עם קופון אלא אם צביר
  const promoResult = await findBestPromotion(cart);
  const promotion =
    promoResult && (!coupon || promoResult.promotion.combinable_with_coupon) ? promoResult : null;

  const shippingPrice = couponFreeShipping && !shippingMethod.isPickup ? 0 : basePrice;
  const totals = computeTotals(
    cart,
    shippingPrice,
    settings,
    0,
    couponDiscount + (promotion?.discountAmount ?? 0),
  );

  return {
    ok: true,
    shippingMethod,
    shippingPrice,
    etaDays,
    totals,
    coupon,
    couponError,
    couponDiscount,
    promotionId: promotion?.promotion.id ?? null,
    promotionName: promotion?.promotion.name ?? null,
  };
}

export interface ManualOrderItemInput {
  bookId: string;
  quantity: number;
  /** [1.9] מחיר שהצוות הקליד לפריט — נבחן רק כשלספר אין מחיר קטלוגי (ראו validateCart). */
  manualUnitPrice?: number;
}

/** ממפה bookId למחיר הידני שהוקלד — תמיד מסונן ל-manualUnitPrice מספרי, כדי לא להעביר undefined כערך. */
function priceOverridesFrom(items: ManualOrderItemInput[]): Record<string, number> {
  const overrides: Record<string, number> = {};
  for (const item of items) {
    if (item.manualUnitPrice != null) overrides[item.bookId] = item.manualUnitPrice;
  }
  return overrides;
}

export interface ManualOrderInput {
  items: ManualOrderItemInput[];
  contact: { name: string; phone: string; email: string | null };
  fulfillment:
    | { type: 'pickup' }
    | { type: 'shipping'; methodId: string; address: ShippingAddress; courierNotes?: string };
  couponCode: string | null;
  note: string | null;
  locale: string;
  actor: Actor;
  /** מפתח שנוצר בטופס פעם אחת — לחיצה כפולה/‏retry מחזירים את אותה הזמנה */
  idempotencyKey?: string | null;
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

  const cart = await validateCart(input.items, input.locale, undefined, {
    allowUnpublished: true,
    priceOverrides: priceOverridesFrom(input.items),
  });
  const activeLines = cart.lines.filter((line) => line.removedReason === null && line.quantity > 0);
  if (activeLines.length === 0) return { ok: false, error: 'לא נבחרו פריטים זמינים' };
  const unavailable = cart.lines.filter((line) => line.removedReason !== null);
  if (unavailable.length > 0) {
    return { ok: false, error: `פריטים לא זמינים: ${unavailable.map((l) => l.title).join(', ')}` };
  }

  const settings = await getStoreSettings();
  const pricing = await resolvePricing(
    cart,
    input.fulfillment,
    settings,
    input.couponCode,
    normalizePhone(input.contact.phone),
    email,
  );
  if (!pricing.ok || !pricing.shippingMethod) {
    return { ok: false, error: pricing.error ?? 'חישוב המחיר נכשל' };
  }
  // קופון שהוזן אך לא תקף — לא לחייב בשקט בלי ההנחה שהנציג הבטיח ללקוח
  if (input.couponCode?.trim() && !pricing.coupon) {
    return { ok: false, error: 'קוד הקופון אינו תקף — הסירו אותו או בדקו את הקוד' };
  }

  const fulfillment = input.fulfillment;
  const address = fulfillment.type === 'pickup' ? null : fulfillment.address;
  if (fulfillment.type === 'shipping') {
    if (!fulfillment.address.city?.trim() || !fulfillment.address.street?.trim()) {
      return { ok: false, error: 'כתובת משלוח חסרה (עיר ורחוב לפחות)' };
    }
  }

  const promised =
    input.fulfillment.type === 'pickup'
      ? null
      : getPromisedDate({ settings, etaBusinessDays: pricing.etaDays, prepDaysOverride: cart.maxPrepDays })
          .toISOString()
          .slice(0, 10);

  // Idempotency אמיתי: המפתח מגיע מהטופס ונוצר שם פעם אחת — לחיצה
  // כפולה שולחת את אותו מפתח ומקבלת חזרה את ההזמנה הקיימת. (המפתח הישן
  // נגזר מטוקן שנוצר מחדש בכל קריאה, ולכן לא היה idempotent כלל.)
  const idempotencyKey = input.idempotencyKey?.trim()
    ? `manual:${input.idempotencyKey.trim().slice(0, 48)}`
    : `manual:${generateGuestToken().token.slice(0, 24)}`;
  const { data: existing } = await service
    .from('orders')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existing) return { ok: true, order: existing as Order };

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
      subtotal: pricing.totals.subtotal,
      discount_total: pricing.totals.discountTotal,
      shipping_total: pricing.totals.shippingTotal,
      donation_amount: 0,
      tax_total: pricing.totals.taxTotal,
      total: pricing.totals.total,
      currency: 'ILS',
      fulfillment_type: input.fulfillment.type,
      shipping_method_id: pricing.shippingMethod.id,
      shipping_method_name_snapshot: pricing.shippingMethod.name,
      promised_delivery_date: promised,
      shipping_address: address,
      courier_notes:
        fulfillment.type === 'shipping' ? fulfillment.courierNotes?.trim().slice(0, 500) || null : null,
      coupon_id: pricing.coupon?.id ?? null,
      coupon_code_snapshot: pricing.coupon?.code ?? null,
      // צילום המבצע האוטומטי — כמו בהזמנת אתר (checkout.ts): בלעדיו דוח
      // הקופונים/מבצעים לא ראה הנחות מבצע בהזמנות טלפוניות.
      promotion_id: pricing.promotionId,
      promotion_name_snapshot: pricing.promotionName,
      guest_token_hash: hash,
      guest_token_expires_at: guestExpiry.toISOString(),
      contact_name: name,
      contact_email: email,
      contact_phone: normalizePhone(input.contact.phone),
      notes: input.note?.trim().slice(0, 1000) || null,
      placed_at: new Date().toISOString(),
      idempotency_key: idempotencyKey,
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

  if (pricing.coupon) {
    await recordRedemption(service, {
      couponId: pricing.coupon.id,
      orderId: order.id,
      customerId: null,
      contactPhone: normalizePhone(input.contact.phone),
      // חלק הקופון בלבד — discountTotal כולל גם את המבצע האוטומטי,
      // ורישומו היה מנפח את דוח הקופונים (המסלול באתר כבר עושה כך).
      amountDiscounted: pricing.couponDiscount,
    });
  }

  await recordOrderEvent(service, order.id, 'order_created', input.actor, {
    channel: 'phone',
    items: activeLines.length,
    coupon: pricing.coupon?.code ?? null,
    promotion: pricing.promotionName,
  });

  return { ok: true, order: order as Order, guestToken: token };
}

export interface ManualOrderPreview {
  ok: boolean;
  error?: string;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  freeShippingApplied: boolean;
  couponValid: boolean;
  couponError: CouponError | null;
  promotionName: string | null;
}

const EMPTY_PREVIEW: Omit<ManualOrderPreview, 'ok' | 'error'> = {
  subtotal: 0,
  shippingTotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  total: 0,
  freeShippingApplied: false,
  couponValid: false,
  couponError: null,
  promotionName: null,
};

/** [1.5] אומדן חי לטופס — אותו resolvePricing שמשמש את היצירה בפועל. */
export async function previewManualOrderTotals(input: {
  items: ManualOrderItemInput[];
  fulfillment: ManualOrderFulfillment;
  couponCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  locale: string;
}): Promise<ManualOrderPreview> {
  const cart = await validateCart(input.items, input.locale, undefined, {
    allowUnpublished: true,
    priceOverrides: priceOverridesFrom(input.items),
  });
  const activeLines = cart.lines.filter((line) => line.removedReason === null && line.quantity > 0);
  if (activeLines.length === 0) {
    return { ok: false, error: 'no_items', ...EMPTY_PREVIEW };
  }

  const settings = await getStoreSettings();
  const pricing = await resolvePricing(
    cart,
    input.fulfillment,
    settings,
    input.couponCode,
    input.contactPhone ? normalizePhone(input.contactPhone) : null,
    input.contactEmail?.trim().toLowerCase() || null,
  );
  if (!pricing.ok) {
    return { ok: false, error: pricing.error, ...EMPTY_PREVIEW, subtotal: cart.subtotal, total: cart.subtotal };
  }

  return {
    ok: true,
    subtotal: pricing.totals.subtotal,
    shippingTotal: pricing.totals.shippingTotal,
    discountTotal: pricing.totals.discountTotal,
    taxTotal: pricing.totals.taxTotal,
    total: pricing.totals.total,
    freeShippingApplied: !pricing.shippingMethod?.isPickup && pricing.shippingPrice === 0 && cart.subtotal > 0,
    couponValid: pricing.coupon !== null,
    couponError: pricing.couponError,
    promotionName: pricing.promotionName,
  };
}
