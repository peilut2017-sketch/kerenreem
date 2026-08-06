'use server';

import { validateCart, type CartInputItem, type ValidatedCart } from './cart';
import { getCommerceFlags, getStoreSettings } from './settings';
import { amountToFreeShipping, getAvailableMethods } from './shipping';
import { getPromisedDate, formatPromisedDate } from './delivery-date';

/**
 * פעולות העגלה. העגלה עצמה מקומית (kr:cart, ‏useLocalMap — לאורח ולמחובר
 * כאחד בשלב זה; עגלה שרתית מגיעה עם החשבונות בשלב 7). השרת הוא שכבת
 * האמת: הלקוח שולח מזהים וכמויות, ומקבל חזרה מחירים, זמינות, סכומים,
 * פס משלוח חינם ותאריך אספקה — מחושבים מול המסד ברגע האמת.
 */

export interface CartViewModel {
  cart: ValidatedCart;
  flags: {
    cartEnabled: boolean;
    checkoutEnabled: boolean;
    expressEnabled: boolean;
  };
  freeShipping: {
    threshold: number | null;
    remaining: number | null;
    achieved: boolean;
  };
  estimatedShipping: number | null;
  estimatedDeliveryDate: string | null;
  estimatedDeliveryLabel: string | null;
  supportPhone: string | null;
}

export async function getCartView(
  items: CartInputItem[],
  locale: string,
  previousPrices?: Record<string, number>,
): Promise<CartViewModel> {
  const [flags, settings, cart] = await Promise.all([
    getCommerceFlags(),
    getStoreSettings(),
    validateCart(items, locale, previousPrices),
  ]);

  const shape = {
    subtotal: cart.subtotal,
    totalWeightGrams: cart.totalWeightGrams,
    freeShippingEligible: cart.freeShippingEligible,
  };

  let estimatedShipping: number | null = null;
  let estimatedDeliveryDate: string | null = null;
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
      estimatedDeliveryDate = promised.toISOString().slice(0, 10);
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
    },
    freeShipping: {
      threshold: settings.free_shipping_threshold,
      remaining,
      achieved:
        settings.free_shipping_threshold != null &&
        cart.freeShippingEligible &&
        cart.subtotal >= settings.free_shipping_threshold,
    },
    estimatedShipping,
    estimatedDeliveryDate,
    estimatedDeliveryLabel,
    supportPhone: settings.support_phone,
  };
}
