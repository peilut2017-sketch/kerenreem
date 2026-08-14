'use server';

import { validateCart, type CartInputItem, type ValidatedCart } from './cart';
import { validateCoupon, type CouponError } from './coupons';
import { findBestPromotion } from './promotions';
import { getCommerceFlags, getStoreSettings } from './settings';
import { amountToFreeShipping, getAvailableMethods } from './shipping';
import { getPromisedDate, formatPromisedDate } from './delivery-date';

/**
 * פעולות העגלה. העגלה עצמה מקומית (kr:cart, ‏useLocalMap — לאורח ולמחובר
 * כאחד בשלב זה; עגלה שרתית מגיעה עם החשבונות בשלב 7). השרת הוא שכבת
 * האמת: הלקוח שולח מזהים וכמויות, ומקבל חזרה מחירים, זמינות, סכומים,
 * פס משלוח חינם ותאריך אספקה — מחושבים מול המסד ברגע האמת.
 */

export interface CartCouponView {
  code: string;
  ok: boolean;
  error?: CouponError;
  minTotal?: number;
  minQuantity?: number;
  discountAmount: number;
  freeShipping: boolean;
}

export interface CartViewModel {
  cart: ValidatedCart;
  flags: {
    cartEnabled: boolean;
    checkoutEnabled: boolean;
    expressEnabled: boolean;
    couponsEnabled: boolean;
  };
  freeShipping: {
    threshold: number | null;
    remaining: number | null;
    achieved: boolean;
  };
  /** [1.1] קופון שהוזן בעגלה (הכרעה 13) — מאומת מחדש בשרת בכל טעינה */
  coupon: CartCouponView | null;
  /** [1.3] מבצע אוטומטי שחל על העגלה — בלי קוד */
  promotion: { name: string; discountAmount: number; combinableWithCoupon: boolean } | null;
  estimatedShipping: number | null;
  estimatedDeliveryLabel: string | null;
  supportPhone: string | null;
}

export async function getCartView(
  items: CartInputItem[],
  locale: string,
  previousPrices?: Record<string, number>,
  couponCode?: string | null,
): Promise<CartViewModel> {
  const [flags, settings, cart] = await Promise.all([
    getCommerceFlags(),
    getStoreSettings(),
    validateCart(items, locale, previousPrices),
  ]);

  // [1.1] הקופון חל כבר בעגלה: אימות שרתי מלא, אותו מנוע כמו ב-Checkout.
  // ההנחה הסופית המחייבת מחושבת שוב ב-placeOrder — כאן תצוגה בלבד.
  let coupon: CartCouponView | null = null;
  const code = couponCode?.trim().toUpperCase() ?? '';
  if (code && flags.couponsEnabled && cart.totalQuantity > 0) {
    const result = await validateCoupon(code, cart, null);
    coupon = {
      code,
      ok: result.ok,
      error: result.error,
      minTotal: result.minTotal,
      minQuantity: result.minQuantity,
      discountAmount: result.discountAmount,
      freeShipping: result.freeShipping,
    };
  }

  // [1.3] מבצע אוטומטי: מוחל מעצמו; אינו נערם עם קופון אלא אם סומן צביר
  const promoResult = cart.totalQuantity > 0 ? await findBestPromotion(cart) : null;
  const promotion =
    promoResult && (!coupon?.ok || promoResult.promotion.combinable_with_coupon)
      ? {
          name: promoResult.promotion.name,
          discountAmount: promoResult.discountAmount,
          combinableWithCoupon: promoResult.promotion.combinable_with_coupon,
        }
      : null;

  const shape = {
    subtotal: cart.subtotal,
    totalWeightGrams: cart.totalWeightGrams,
    freeShippingEligible: cart.freeShippingEligible,
  };

  let estimatedShipping: number | null = null;
  let estimatedDeliveryLabel: string | null = null;

  if (cart.totalQuantity > 0) {
    const methods = await getAvailableMethods(shape, settings);
    const shippingOnly = methods.filter(({ method }) => method.kind !== 'pickup');
    if (shippingOnly.length > 0) {
      const cheapest = shippingOnly.reduce((a, b) => (a.price <= b.price ? a : b));
      estimatedShipping = cheapest.price;
      const promised = getPromisedDate({
        settings,
        etaBusinessDays: cheapest.method.eta_business_days,
        prepDaysOverride: cart.maxPrepDays,
      });
      estimatedDeliveryLabel = formatPromisedDate(promised, locale);
    }
  }

  const remaining = amountToFreeShipping(shape, settings);
  return {
    cart,
    flags: {
      cartEnabled: flags.cartEnabled,
      checkoutEnabled: flags.checkoutEnabled,
      expressEnabled: flags.expressEnabled,
      couponsEnabled: flags.couponsEnabled,
    },
    freeShipping: {
      threshold: settings.free_shipping_threshold,
      remaining,
      achieved:
        settings.free_shipping_threshold != null &&
        cart.freeShippingEligible &&
        cart.subtotal >= settings.free_shipping_threshold,
    },
    coupon,
    promotion,
    estimatedShipping,
    estimatedDeliveryLabel,
    supportPhone: settings.support_phone,
  };
}
