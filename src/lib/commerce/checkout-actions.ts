'use server';

import { cookies, headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import type { CheckoutSessionRecord, ShippingAddress } from '@/lib/supabase/types';
import { validateCart, type CartInputItem, type ValidatedCart } from './cart';
import {
  computeTotals,
  createOrderFromSession,
  createSession,
  loadSession,
  updateSession,
} from './checkout';
import { getCommerceFlags, getStoreSettings } from './settings';
import { getAvailableMethods, type AvailableMethod } from './shipping';
import { formatPromisedDate, getPromisedDate, toIsoDate } from './delivery-date';
import { isValidIsraeliPhone, normalizePhone } from './guest-token';
import { allowRequest, ipBucket } from './rate-limit';
import { startPayment } from './payments';
import { sendOrderEmail } from './notifications';
import { recordOrderEvent } from './orders';

/**
 * פעולות ה-Checkout (תרשימים 4–7). העיקרון: הדפדפן שולח כוונות; כל
 * חישוב מחייב — מחיר, מלאי, משלוח, תאריך — נעשה כאן מול המסד. ה-session
 * מזוהה ב-cookie httpOnly; רענון משחזר את ההתקדמות.
 */

const SESSION_COOKIE = 'kr-checkout';
const SESSION_TTL_DAYS = 7;

async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

async function writeSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export interface MethodOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isPickup: boolean;
  price: number;
  etaBusinessDays: number;
  promisedDate: string;
  promisedDateLabel: string;
}

export interface CheckoutBootstrap {
  ok: boolean;
  enabled: boolean;
  paymentsEnabled: boolean;
  expressEnabled: boolean;
  sessionId: string | null;
  session: Pick<
    CheckoutSessionRecord,
    | 'contact_name'
    | 'contact_phone'
    | 'contact_email'
    | 'fulfillment'
    | 'is_gift'
    | 'gift_recipient_name'
    | 'gift_message'
    | 'gift_hide_prices'
    | 'notify_channel'
    | 'status'
  > | null;
  cart: ValidatedCart | null;
  methods: MethodOption[];
  installments: { minTotal: number; max: number } | null;
  supportPhone: string | null;
  pickup: { address: Record<string, string>; hours: string | null } | null;
}

async function buildMethodOptions(
  cart: ValidatedCart,
  locale: string,
): Promise<MethodOption[]> {
  const settings = await getStoreSettings();
  const available = await getAvailableMethods(
    {
      subtotal: cart.subtotal,
      totalWeightGrams: cart.totalWeightGrams,
      freeShippingEligible: cart.freeShippingEligible,
    },
    settings,
  );
  return available.map(({ method, price }: AvailableMethod) => {
    const promised = getPromisedDate({
      settings,
      etaBusinessDays: method.eta_business_days,
      prepDaysOverride: cart.maxPrepDays,
      isPickup: method.kind === 'pickup',
    });
    return {
      id: method.id,
      slug: method.slug,
      name: locale === 'en' && method.name_en ? method.name_en : method.name_he,
      description:
        locale === 'en' && method.description_en ? method.description_en : method.description_he,
      isPickup: method.kind === 'pickup',
      price,
      etaBusinessDays: method.eta_business_days,
      promisedDate: toIsoDate(promised),
      promisedDateLabel: formatPromisedDate(promised, locale),
    };
  });
}

/** כניסה ל-Checkout: יצירת session (או שחזור הקיים) + כל נתוני העמוד. */
export async function startCheckout(
  items: CartInputItem[],
  locale: string,
  express?: { wallet: 'bit' | 'apple_pay' | 'google_pay' } | null,
): Promise<CheckoutBootstrap> {
  const flags = await getCommerceFlags();
  const disabled: CheckoutBootstrap = {
    ok: false,
    enabled: false,
    paymentsEnabled: false,
    expressEnabled: false,
    sessionId: null,
    session: null,
    cart: null,
    methods: [],
    installments: null,
    supportPhone: null,
    pickup: null,
  };
  if (!flags.checkoutEnabled) return disabled;

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('checkout-start', headerList), 30, 60))) return disabled;

  const cart = await validateCart(items, locale);
  if (cart.totalQuantity === 0 && items.length > 0) {
    return { ...disabled, ok: false, enabled: true, cart };
  }

  let session = null;
  const existingId = await readSessionId();
  if (existingId) {
    const existing = await loadSession(existingId);
    if (existing && (existing.status === 'open' || existing.status === 'contact_entered')) {
      session = await updateSession(existing.id, {
        items: cart.lines
          .filter((line) => line.removedReason === null)
          .map((line) => ({ book_id: line.bookId, quantity: line.quantity })),
        is_express: Boolean(express),
        express_wallet: express?.wallet ?? null,
        locale,
      });
    }
  }
  if (!session) {
    session = await createSession({
      items: cart.lines
        .filter((line) => line.removedReason === null)
        .map((line) => ({ book_id: line.bookId, quantity: line.quantity })),
      locale,
      is_express: Boolean(express),
      express_wallet: express?.wallet ?? null,
    });
    if (session) await writeSessionCookie(session.id);
  }
  if (!session) return disabled;

  const settings = await getStoreSettings();
  return {
    ok: true,
    enabled: true,
    paymentsEnabled: flags.paymentsEnabled,
    expressEnabled: flags.expressEnabled,
    sessionId: session.id,
    session: {
      contact_name: session.contact_name,
      contact_phone: session.contact_phone,
      contact_email: session.contact_email,
      fulfillment: session.fulfillment,
      is_gift: session.is_gift,
      gift_recipient_name: session.gift_recipient_name,
      gift_message: session.gift_message,
      gift_hide_prices: session.gift_hide_prices,
      notify_channel: session.notify_channel,
      status: session.status,
    },
    cart,
    methods: await buildMethodOptions(cart, locale),
    installments:
      settings.installments_min_total <= cart.subtotal
        ? { minTotal: settings.installments_min_total, max: settings.installments_max }
        : null,
    supportPhone: settings.support_phone,
    pickup: settings.pickup_enabled
      ? { address: settings.pickup_address, hours: settings.pickup_hours }
      : null,
  };
}

export interface ActionResult {
  ok: boolean;
  fieldErrors?: Record<string, string>;
  error?: string;
}

/** בלוק 1 — זיהוי: טלפון תחילה, מייל חובה. שמירה = בסיס עגלה נטושה. */
export async function saveContact(input: {
  phone: string;
  name: string;
  email: string;
}): Promise<ActionResult> {
  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'session' };

  const fieldErrors: Record<string, string> = {};
  if (!input.phone.trim() || !isValidIsraeliPhone(input.phone)) fieldErrors.phone = 'invalid';
  if (!input.name.trim() || input.name.trim().length < 2) fieldErrors.name = 'required';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.email.trim())) fieldErrors.email = 'invalid';
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const updated = await updateSession(sessionId, {
    contact_phone: normalizePhone(input.phone),
    contact_name: input.name.trim().slice(0, 120),
    contact_email: input.email.trim().slice(0, 160),
    status: 'contact_entered',
  });
  return { ok: Boolean(updated) };
}

/** בלוק 2 — אספקה: משלוח עם כתובת מלאה, או איסוף עצמי. */
export async function saveFulfillment(input: {
  methodId: string;
  isPickup: boolean;
  address?: Partial<ShippingAddress>;
  courierNotes?: string;
}): Promise<ActionResult> {
  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'session' };

  if (!input.isPickup) {
    const a = input.address ?? {};
    const fieldErrors: Record<string, string> = {};
    if (!a.recipient_name?.trim()) fieldErrors.recipient_name = 'required';
    if (!a.city?.trim()) fieldErrors.city = 'required';
    if (!a.street?.trim()) fieldErrors.street = 'required';
    if (!a.house_number?.trim()) fieldErrors.house_number = 'required';
    if (a.zip && !/^\d{5,7}$/.test(a.zip.trim())) fieldErrors.zip = 'invalid';
    if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  }

  const updated = await updateSession(sessionId, {
    fulfillment: {
      type: input.isPickup ? 'pickup' : 'shipping',
      method_id: input.methodId,
      address: input.isPickup ? undefined : input.address,
      courier_notes: input.courierNotes?.slice(0, 500),
    },
  });
  return { ok: Boolean(updated) };
}

/** בלוק 3 — מתנה, ערוץ נייד, אישור תקנון. */
export async function saveExtras(input: {
  isGift: boolean;
  giftRecipientName?: string;
  giftMessage?: string;
  giftHidePrices?: boolean;
  notifyChannel?: 'sms' | 'whatsapp' | null;
  termsAccepted: boolean;
}): Promise<ActionResult> {
  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'session' };
  if (!input.termsAccepted) return { ok: false, fieldErrors: { terms: 'required' } };

  const updated = await updateSession(sessionId, {
    is_gift: input.isGift,
    gift_recipient_name: input.isGift ? input.giftRecipientName?.slice(0, 120) ?? null : null,
    gift_message: input.isGift ? input.giftMessage?.slice(0, 300) ?? null : null,
    gift_hide_prices: input.giftHidePrices ?? true,
    notify_channel: input.notifyChannel ?? null,
    terms_accepted_at: new Date().toISOString(),
  });
  return { ok: Boolean(updated) };
}

export interface PlaceOrderResult {
  ok: boolean;
  mode?: 'redirect_to_payment' | 'created_no_payment';
  redirectUrl?: string;
  orderNumber?: number;
  orderId?: string;
  error?:
    | 'session'
    | 'terms'
    | 'contact'
    | 'fulfillment'
    | 'total_changed'
    | 'insufficient_stock'
    | 'unavailable'
    | 'payment_error'
    | 'rate_limited'
    | 'server';
  serverTotal?: number;
}

/**
 * "מעבר לתשלום" — תרשים 6 + תרשים 7: אימות סופי, השוואת הסכום שהוצג,
 * יצירת הזמנה עם צילום ושמירת מלאי, ופתיחת דף תשלום במורנינג.
 * Idempotent: לחיצה כפולה מחזירה את אותה הזמנה ואותו דף תשלום.
 */
export async function placeOrder(input: { displayedTotal: number }): Promise<PlaceOrderResult> {
  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'session' };

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('place-order', headerList), 10, 60))) {
    return { ok: false, error: 'rate_limited' };
  }

  const session = await loadSession(sessionId);
  if (!session) return { ok: false, error: 'session' };

  // Idempotency: ההזמנה כבר נוצרה מה-session הזה — ממשיכים ממנה
  if (session.order_id) {
    return resumeExistingOrder(session.order_id);
  }

  if (!session.terms_accepted_at) return { ok: false, error: 'terms' };
  if (!session.contact_phone || !session.contact_email || !session.contact_name) {
    return { ok: false, error: 'contact' };
  }
  const fulfillment = session.fulfillment;
  if (!fulfillment?.type || !fulfillment.method_id) return { ok: false, error: 'fulfillment' };

  const cart = await validateCart(session.items.map((item) => ({ bookId: item.book_id, quantity: item.quantity })), session.locale);
  if (cart.totalQuantity === 0) return { ok: false, error: 'unavailable' };

  const settings = await getStoreSettings();
  const methods = await buildMethodOptions(cart, session.locale);
  const method = methods.find((m) => m.id === fulfillment.method_id);
  if (!method) return { ok: false, error: 'fulfillment' };

  const totals = computeTotals(cart, method.price, settings, session.donation_amount ?? 0);

  // הסכום שהוצג ללקוח מול המחושב עכשיו — פער עוצר, לא מחייב בשקט
  if (Math.abs(totals.total - input.displayedTotal) >= 0.01) {
    return { ok: false, error: 'total_changed', serverTotal: totals.total };
  }

  const address = !method.isPickup
    ? ({
        recipient_name: fulfillment.address?.recipient_name ?? session.contact_name,
        phone: fulfillment.address?.phone ?? session.contact_phone,
        city: fulfillment.address?.city ?? '',
        street: fulfillment.address?.street ?? '',
        house_number: fulfillment.address?.house_number ?? '',
        entrance: fulfillment.address?.entrance,
        floor: fulfillment.address?.floor,
        apartment: fulfillment.address?.apartment,
        zip: fulfillment.address?.zip,
      } satisfies ShippingAddress)
    : null;

  const created = await createOrderFromSession({
    session,
    cart,
    totals,
    shippingMethod: { id: method.id, name: method.name, isPickup: method.isPickup },
    promisedDeliveryDate: method.promisedDate,
    address,
    taxRate: settings.vat_mode === 'included' ? settings.vat_rate : 0,
  });

  if (!created.ok || !created.order) {
    return {
      ok: false,
      error: created.error === 'insufficient_stock' ? 'insufficient_stock' : created.error === 'unavailable' ? 'unavailable' : 'server',
    };
  }

  const service = createServiceClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const trackUrl = created.guestToken
    ? `${siteUrl}/orders/track/${created.guestToken}`
    : undefined;

  if (service) {
    await sendOrderEmail(service, 'order_confirmation', created.order, {
      items: cart.lines
        .filter((line) => line.removedReason === null)
        .map((line) => ({ title: line.title, quantity: line.quantity, lineTotal: line.lineTotal })),
      trackUrl,
      promisedDateLabel: method.promisedDateLabel,
    });
  }

  const flags = await getCommerceFlags();
  if (!flags.paymentsEnabled) {
    // שלב 3 בתוכנית: הזמנה בלי גבייה מקוונת — הצוות גובה טלפונית
    return {
      ok: true,
      mode: 'created_no_payment',
      orderNumber: created.order.order_number,
      orderId: created.order.id,
    };
  }

  const payment = await startPayment(created.order, {
    wallet: session.express_wallet,
    siteUrl,
  });
  if (!payment.ok || !payment.paymentUrl) {
    return {
      ok: true,
      mode: 'created_no_payment',
      orderNumber: created.order.order_number,
      orderId: created.order.id,
      error: 'payment_error',
    };
  }
  return {
    ok: true,
    mode: 'redirect_to_payment',
    redirectUrl: payment.paymentUrl,
    orderNumber: created.order.order_number,
    orderId: created.order.id,
  };
}

async function resumeExistingOrder(orderId: string): Promise<PlaceOrderResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };
  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'server' };

  if (order.payment_state === 'paid') {
    return { ok: true, mode: 'created_no_payment', orderNumber: order.order_number, orderId };
  }
  const flags = await getCommerceFlags();
  if (!flags.paymentsEnabled) {
    return { ok: true, mode: 'created_no_payment', orderNumber: order.order_number, orderId };
  }
  const payment = await startPayment(order, {
    wallet: null,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? '',
  });
  if (payment.ok && payment.paymentUrl) {
    return {
      ok: true,
      mode: 'redirect_to_payment',
      redirectUrl: payment.paymentUrl,
      orderNumber: order.order_number,
      orderId,
    };
  }
  return { ok: true, mode: 'created_no_payment', orderNumber: order.order_number, orderId };
}

export interface ResultState {
  found: boolean;
  orderNumber?: number;
  paymentState?: string;
  documentState?: string;
  fulfillmentType?: string;
  promisedDateLabel?: string | null;
  supportPhone?: string | null;
}

/**
 * מצב ההזמנה לעמוד התוצאה — מזוהה דרך ה-session cookie בלבד (הלקוח
 * שחזר מדף הסליקה מחזיק אותו). "מעבדים את התשלום" — תרשים 19.
 */
export async function getResultState(): Promise<ResultState> {
  const sessionId = await readSessionId();
  if (!sessionId) return { found: false };
  const session = await loadSession(sessionId);
  if (!session?.order_id) return { found: false };

  const service = createServiceClient();
  if (!service) return { found: false };
  const { data: order } = await service
    .from('orders')
    .select('order_number, payment_state, document_state, fulfillment_type, promised_delivery_date, locale')
    .eq('id', session.order_id)
    .maybeSingle();
  if (!order) return { found: false };

  const settings = await getStoreSettings();
  return {
    found: true,
    orderNumber: order.order_number,
    paymentState: order.payment_state,
    documentState: order.document_state,
    fulfillmentType: order.fulfillment_type,
    promisedDateLabel: order.promised_delivery_date
      ? formatPromisedDate(new Date(order.promised_delivery_date), order.locale)
      : null,
    supportPhone: settings.support_phone,
  };
}

/** רישום ביטול מצד הלקוח מעמוד המעקב — פותח בקשה, אינו מבטל אוטומטית. */
export async function requestCancelFromResult(reason: string): Promise<ActionResult> {
  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'session' };
  const session = await loadSession(sessionId);
  if (!session?.order_id) return { ok: false, error: 'session' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };
  await recordOrderEvent(service, session.order_id, 'cancel_requested', { type: 'customer' }, {
    reason: reason.slice(0, 300),
  });
  return { ok: true };
}
