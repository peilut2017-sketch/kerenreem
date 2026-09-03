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

import { recordRedemption, validateCoupon, type CouponError } from './coupons';
import { findBestPromotion } from './promotions';
import { getCustomerSession, getMyAddresses } from './account';
import { localizedSiteUrl } from './site-url';

/**
 * פעולות ה-Checkout (תרשימים 4–7). העיקרון: הדפדפן שולח כוונות; כל
 * חישוב מחייב — מחיר, מלאי, משלוח, תאריך — נעשה כאן מול המסד. ה-session
 * מזוהה ב-cookie httpOnly; רענון משחזר את ההתקדמות.
 */

const SESSION_COOKIE = 'kr-checkout';
const SESSION_TTL_DAYS = 7;
/** [1.6] טוקן המעקב הגולמי — לעולם לא נשמר במסד; עוגייה קצרת-חיים מעבירה אותו לעמוד התודה (ח.12) */
const TRACK_TOKEN_COOKIE = 'kr-track-token';

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
  couponsEnabled: boolean;
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
    | 'coupon_code'
  > | null;
  cart: ValidatedCart | null;
  /** [1.3] מבצע אוטומטי שחל — הסכום המוצג חייב לכלול אותו */
  promotion: { name: string; discountAmount: number; combinableWithCoupon: boolean } | null;
  methods: MethodOption[];
  installments: { minTotal: number; max: number } | null;
  supportPhone: string | null;
  pickup: { address: Record<string, string>; hours: string | null } | null;
  /** [1.6] שיעור מע"מ להצגה בסיכום (ח.10) — 0 כש-vat_mode אינו included, כמו ב-computeTotals */
  vatRate: number;
}

async function buildMethodOptions(
  cart: ValidatedCart,
  locale: string,
  /** [1.6] אכיפת אזור משלוח (ט.16) — undefined כשעדיין אין כתובת ידועה */
  city?: string | null,
): Promise<MethodOption[]> {
  const settings = await getStoreSettings();
  const available = await getAvailableMethods(
    {
      subtotal: cart.subtotal,
      totalWeightGrams: cart.totalWeightGrams,
      freeShippingEligible: cart.freeShippingEligible,
    },
    settings,
    city,
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
    couponsEnabled: false,
    sessionId: null,
    session: null,
    cart: null,
    promotion: null,
    methods: [],
    installments: null,
    supportPhone: null,
    pickup: null,
    vatRate: 0,
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
    } else if (existing?.status === 'converted' && existing.order_id) {
      // הזמנה כבר נוצרה מה-session הזה (idempotency_key). כל עוד היא טרם
      // שולמה — ממשיכים על אותה session כדי ש-placeOrder יזהה session.order_id
      // ויפיק קישור תשלום חדש דרך resumeExistingOrder, במקום ליצור session
      // חדשה בלי order_id (שהייתה שוברת את מסלול "ניסיון תשלום חוזר").
      const service = createServiceClient();
      const { data: existingOrder } = service
        ? await service.from('orders').select('payment_state').eq('id', existing.order_id).maybeSingle()
        : { data: null };
      // ורק אם הסל לא השתנה מאז: ההזמנה הקיימת נבנתה מפריטי ה-session,
      // ואם הלקוח הוסיף/הסיר ספר מאז, המשך על אותה session היה מציג לו
      // את סכום הסל החדש בכפתור אבל גובה את סכום ההזמנה הישנה. סל שונה
      // ⇒ session חדשה (וההזמנה הישנה פגה בשגרת התחזוקה).
      const signature = (pairs: { book_id: string; quantity: number }[]) =>
        pairs.map((pair) => `${pair.book_id}:${pair.quantity}`).sort().join('|');
      const liveItems = cart.lines
        .filter((line) => line.removedReason === null)
        .map((line) => ({ book_id: line.bookId, quantity: line.quantity }));
      if (
        existingOrder &&
        existingOrder.payment_state !== 'paid' &&
        signature(liveItems) === signature(existing.items ?? [])
      ) {
        session = existing;
      }
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
  const promoResult = await findBestPromotion(cart);

  // [1.3] לקוח מחובר: הפרטים וכתובת ברירת המחדל מהחשבון ממלאים את הטופס
  // מראש (פרק 4.6) — רק שדות שה-session עוד לא מילא; הלקוח יכול לשנות הכול.
  let contactName = session.contact_name;
  let contactPhone = session.contact_phone;
  let contactEmail = session.contact_email;
  let fulfillment = session.fulfillment;
  const customerSession = await getCustomerSession();
  if (customerSession?.customer) {
    const customer = customerSession.customer;
    contactName = contactName ?? customer.full_name;
    // הטלפון הזמני ("pending:") של חשבון בלי הזמנת מקור אינו טלפון אמיתי
    if (!contactPhone && !customer.phone.startsWith('pending:')) contactPhone = customer.phone;
    contactEmail = contactEmail ?? customer.email ?? customerSession.email;
    if (!fulfillment?.address?.city) {
      const addresses = await getMyAddresses();
      const preferred = addresses.find((a) => a.is_default) ?? addresses[0];
      if (preferred) {
        fulfillment = {
          ...fulfillment,
          address: {
            recipient_name: preferred.recipient_name,
            phone: preferred.phone ?? contactPhone ?? '',
            city: preferred.city,
            street: preferred.street,
            house_number: preferred.house_number,
            entrance: preferred.entrance ?? undefined,
            floor: preferred.floor ?? undefined,
            apartment: preferred.apartment ?? undefined,
            zip: preferred.zip ?? undefined,
          },
        };
      }
    }
  }

  return {
    ok: true,
    enabled: true,
    paymentsEnabled: flags.paymentsEnabled,
    expressEnabled: flags.expressEnabled,
    couponsEnabled: flags.couponsEnabled,
    sessionId: session.id,
    session: {
      contact_name: contactName,
      contact_phone: contactPhone,
      contact_email: contactEmail,
      fulfillment,
      is_gift: session.is_gift,
      gift_recipient_name: session.gift_recipient_name,
      gift_message: session.gift_message,
      gift_hide_prices: session.gift_hide_prices,
      notify_channel: session.notify_channel,
      status: session.status,
      coupon_code: session.coupon_code,
    },
    cart,
    promotion: promoResult
      ? {
          name: promoResult.promotion.name,
          discountAmount: promoResult.discountAmount,
          combinableWithCoupon: promoResult.promotion.combinable_with_coupon,
        }
      : null,
    // [1.6] אם כבר יש כתובת ידועה (session שחזר, או ברירת מחדל מהחשבון
    // שמולאה למעלה) — הרשימה כבר מסוננת לאזור מההתחלה, לא רק ב-placeOrder
    methods: await buildMethodOptions(cart, locale, fulfillment?.address?.city),
    installments:
      settings.installments_min_total <= cart.subtotal
        ? { minTotal: settings.installments_min_total, max: settings.installments_max }
        : null,
    supportPhone: settings.support_phone,
    pickup: settings.pickup_enabled
      ? { address: settings.pickup_address, hours: settings.pickup_hours }
      : null,
    vatRate: settings.vat_mode === 'included' ? settings.vat_rate : 0,
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
  // אותה הגבלת קצב כמו שאר פעולות ה-session — הושמטה כאן בטעות במקור
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('checkout-save', headerList), 60, 60))) {
    return { ok: false, error: 'session' };
  }

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
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('checkout-save', headerList), 60, 60))) {
    return { ok: false, error: 'session' };
  }

  // אותם חסמי אורך כמו בכתובות החשבון (saveMyAddress): הכתובת נכתבת
  // ל-jsonb בלי constraint במסד ומודפסת בכל מדבקה ודוח — ערך פרוע היה
  // מנפח את ההזמנה ואת כל מסכי ההדפסה שלה.
  const cap = (value: string | undefined, max: number) => value?.trim().slice(0, max) || undefined;
  const address: Partial<ShippingAddress> | undefined = input.isPickup
    ? undefined
    : {
        recipient_name: cap(input.address?.recipient_name, 120),
        phone: cap(input.address?.phone, 30),
        city: cap(input.address?.city, 80),
        street: cap(input.address?.street, 120),
        house_number: cap(input.address?.house_number, 20),
        entrance: cap(input.address?.entrance, 20),
        floor: cap(input.address?.floor, 20),
        apartment: cap(input.address?.apartment, 20),
        zip: cap(input.address?.zip, 12),
      };

  if (!input.isPickup) {
    const a = address ?? {};
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
      address,
      courier_notes: input.courierNotes?.trim().slice(0, 500),
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
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('checkout-save', headerList), 60, 60))) {
    return { ok: false, error: 'session' };
  }
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

export interface CouponActionResult {
  ok: boolean;
  error?: CouponError;
  minTotal?: number;
  code?: string;
  discountAmount?: number;
  freeShipping?: boolean;
}

/** החלת קופון על ה-session — אימות מלא בשרת; הקוד נשמר ומאומת שוב ב-placeOrder. */
export async function applyCoupon(code: string): Promise<CouponActionResult> {
  const flags = await getCommerceFlags();
  if (!flags.couponsEnabled) return { ok: false, error: 'invalid' };

  const sessionId = await readSessionId();
  if (!sessionId) return { ok: false, error: 'invalid' };
  const session = await loadSession(sessionId);
  if (!session) return { ok: false, error: 'invalid' };

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('coupon-apply', headerList), 10, 60))) {
    return { ok: false, error: 'invalid' };
  }

  const cart = await validateCart(
    session.items.map((item) => ({ bookId: item.book_id, quantity: item.quantity })),
    session.locale,
  );
  const result = await validateCoupon(code, cart, session.contact_phone, session.contact_email);
  if (!result.ok || !result.coupon) {
    return { ok: false, error: result.error ?? 'invalid', minTotal: result.minTotal };
  }

  // [1.1] צבירת קופונים (הכרעה 13): קופון שני על session שכבר מחזיק קופון
  // אחר נחסם אלא אם *שניהם* מסומנים "ניתן לצירוף". ברירת המחדל: לא.
  // (צבירה בפועל של שני קופונים צבירים תגיע עם מנוע ה-promotions; עד אז
  // צבירים מחליפים זה את זה במפורש, לא-צבירים נחסמים עם הסבר.)
  const existingCode = session.coupon_code?.toUpperCase() ?? null;
  if (existingCode && existingCode !== result.coupon.code) {
    const existing = await validateCoupon(existingCode, cart, session.contact_phone, session.contact_email);
    const bothCombinable =
      Boolean(existing.coupon?.combinable_with_coupons) &&
      Boolean(result.coupon.combinable_with_coupons);
    if (existing.ok && !bothCombinable) {
      return { ok: false, error: 'not_combinable' };
    }
  }

  await updateSession(sessionId, { coupon_code: result.coupon.code });
  return {
    ok: true,
    code: result.coupon.code,
    discountAmount: result.discountAmount,
    freeShipping: result.freeShipping,
  };
}

export async function removeCoupon(): Promise<void> {
  const sessionId = await readSessionId();
  if (sessionId) await updateSession(sessionId, { coupon_code: null });
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

  // מתג הכיבוי נבדק גם כאן, לא רק ב-startCheckout: לקוח שמחזיק עוגיית
  // session פתוחה יכול היה להמשיך ליצור הזמנות, לשריין מלאי ולשרוף
  // קופונים גם אחרי שהבעלים כיבה את ה-checkout.
  const flags = await getCommerceFlags();
  if (!flags.checkoutEnabled) return { ok: false, error: 'unavailable' };

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('place-order', headerList), 10, 60))) {
    return { ok: false, error: 'rate_limited' };
  }

  const session = await loadSession(sessionId);
  if (!session) return { ok: false, error: 'session' };

  // Idempotency: ההזמנה כבר נוצרה מה-session הזה — ממשיכים ממנה
  if (session.order_id) {
    return resumeExistingOrder(session.order_id, input.displayedTotal);
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
  // [1.6] אכיפת אזור משלוח בפועל (ט.16): הכתובת שהלקוח אישר בבלוק 2 —
  // אם השיטה שנבחרה משויכת לאזור שלא כולל את העיר הזו, היא לא תימצא
  // ברשימה כאן, וההזמנה תיעצר עם error:'fulfillment' בדיוק כמו שיטה שבוטלה
  const methods = await buildMethodOptions(cart, session.locale, fulfillment.address?.city);
  const method = methods.find((m) => m.id === fulfillment.method_id);
  if (!method) return { ok: false, error: 'fulfillment' };

  // קופון שנשמר ב-session מאומת שוב ברגע האמת — תוקף/מלאי/מגבלות יכלו להשתנות
  let couponDiscount = 0;
  let couponFreeShipping = false;
  let coupon: { id: string; code: string } | null = null;
  if (session.coupon_code) {
    const couponResult = await validateCoupon(session.coupon_code, cart, session.contact_phone, session.contact_email);
    if (couponResult.ok && couponResult.coupon) {
      couponDiscount = couponResult.discountAmount;
      couponFreeShipping = couponResult.freeShipping;
      coupon = { id: couponResult.coupon.id, code: couponResult.coupon.code };
    } else {
      // הקופון פג בין הסקירה לתשלום — עצירה מפורשת, לא חיוב שקט בלעדיו
      await updateSession(sessionId, { coupon_code: null });
      return { ok: false, error: 'total_changed', serverTotal: undefined };
    }
  }

  // [1.3] מבצע אוטומטי — אותו כלל כמו בעגלה: לא נערם עם קופון אלא אם צביר
  const promoResult = await findBestPromotion(cart);
  const promotion =
    promoResult && (!coupon || promoResult.promotion.combinable_with_coupon) ? promoResult : null;

  const shippingPrice = couponFreeShipping && !method.isPickup ? 0 : method.price;
  const totals = computeTotals(
    cart,
    shippingPrice,
    settings,
    session.donation_amount ?? 0,
    couponDiscount + (promotion?.discountAmount ?? 0),
  );

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
    coupon,
    promotion: promotion
      ? { id: promotion.promotion.id, name: promotion.promotion.name }
      : null,
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
    ? localizedSiteUrl(session.locale, `/orders/track/${created.guestToken}`)
    : undefined;

  // [1.6] קישור מעקב בעמוד התודה (ח.12, ביקורת ב.23) — הטוקן הגולמי לעולם
  // אינו נשמר במסד (רק ה-hash שלו), כך שעמוד /checkout/result לא יכול
  // לשחזר אותו משם. עוגיית httpOnly קצרת-חיים, כמו kr-checkout, מעבירה
  // אותו הלאה בלי לחשוף אותו ב-URL/היסטוריה — לא ב-query string.
  if (created.guestToken) {
    const store = await cookies();
    store.set(TRACK_TOKEN_COOKIE, created.guestToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 15 * 60,
    });
  }

  if (service && coupon && session.contact_phone) {
    await recordRedemption(service, {
      couponId: coupon.id,
      orderId: created.order.id,
      customerId: session.customer_id,
      contactPhone: session.contact_phone,
      amountDiscounted: couponDiscount,
    });
  }

  // [1.2] תיעוד הסכמות (פרק 4.8, מודל 3.3): אישור התקנון הוא תנאי להזמנה
  // — נרשם תמיד; בחירת ערוץ נייד נרשמת רק כשסומנה (תיבה ריקה, החלטה 23)
  if (service) {
    const consentRows: {
      customer_id: string | null;
      email: string | null;
      phone: string | null;
      kind: 'terms' | 'channel_sms' | 'channel_whatsapp';
      granted: boolean;
      source: 'checkout';
      order_id: string;
    }[] = [
      {
        customer_id: session.customer_id,
        email: session.contact_email,
        phone: session.contact_phone,
        kind: 'terms',
        granted: true,
        source: 'checkout',
        order_id: created.order.id,
      },
    ];
    if (session.notify_channel === 'sms' || session.notify_channel === 'whatsapp') {
      consentRows.push({
        customer_id: session.customer_id,
        email: session.contact_email,
        phone: session.contact_phone,
        kind: session.notify_channel === 'sms' ? 'channel_sms' : 'channel_whatsapp',
        granted: true,
        source: 'checkout',
        order_id: created.order.id,
      });
    }
    const { error: consentError } = await service.from('consent_events').insert(consentRows);
    if (consentError) console.error('[commerce:checkout] consent', consentError.message);
  }

  // תשלום נפתח *לפני* שליחת מייל האישור, כדי שהקישור לתשלום (payLink) יהיה
  // בתוך המייל הראשון שהלקוח מקבל — לקוח שנכשל/נטש בדף הסליקה חוזר לשלם
  // מהמייל בלי לחפש את האתר מחדש (סבב 1.4, קריטי-2).
  let paymentUrl: string | null = null;
  let paymentFailed = false;
  if (flags.paymentsEnabled) {
    const payment = await startPayment(created.order, {
      wallet: session.express_wallet,
      siteUrl,
    });
    if (payment.ok && payment.paymentUrl) {
      paymentUrl = payment.paymentUrl;
    } else {
      paymentFailed = true;
    }
  }

  if (service) {
    await sendOrderEmail(service, 'order_confirmation', created.order, {
      items: cart.lines
        .filter((line) => line.removedReason === null)
        .map((line) => ({ title: line.title, quantity: line.quantity, lineTotal: line.lineTotal })),
      trackUrl,
      promisedDateLabel: method.promisedDateLabel,
      paymentUrl,
    });
  }

  if (!flags.paymentsEnabled) {
    // שלב 3 בתוכנית: הזמנה בלי גבייה מקוונת — הצוות גובה טלפונית
    return {
      ok: true,
      mode: 'created_no_payment',
      orderNumber: created.order.order_number,
      orderId: created.order.id,
    };
  }

  if (paymentFailed || !paymentUrl) {
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
    redirectUrl: paymentUrl,
    orderNumber: created.order.order_number,
    orderId: created.order.id,
  };
}

async function resumeExistingOrder(orderId: string, displayedTotal: number): Promise<PlaceOrderResult> {
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };
  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'server' };

  if (order.payment_state === 'paid') {
    return { ok: true, mode: 'created_no_payment', orderNumber: order.order_number, orderId };
  }
  // אותו שומר "הסכום השתנה" כמו ביצירת הזמנה חדשה: מה שהלקוח ראה בכפתור
  // חייב להיות מה שייגבה על ההזמנה שממשיכים ממנה.
  if (Math.abs(Number(order.total) - displayedTotal) >= 0.01) {
    return { ok: false, error: 'total_changed', serverTotal: Number(order.total) };
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
  accountsEnabled?: boolean;
  /** [1.6] קישור מעקב אורח (ח.12) — מהעוגייה הקצרה, לא מהמסד (רק ה-hash נשמר שם) */
  trackToken?: string | null;
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
  const flags = await getCommerceFlags();
  const store = await cookies();
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
    accountsEnabled: flags.accountsEnabled,
    trackToken: store.get(TRACK_TOKEN_COOKIE)?.value ?? null,
  };
}

