import 'server-only';
import { cache } from 'react';
import { createStaticClient } from '@/lib/supabase/server';
import type { ShippingMethod, StoreSettings } from '@/lib/supabase/types';
import { round2 } from './pricing';

/**
 * מנוע התעריפים (פרק 11 במסמך האב). השיטות מוגדרות בנתונים
 * (shipping_methods) — הוספת שיטה היא שורה בטבלה, לא שינוי קוד.
 */

export const getShippingMethods = cache(async (): Promise<ShippingMethod[]> => {
  const supabase = createStaticClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shipping_methods')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) {
    console.error('[commerce:shipping]', error.message);
    return [];
  }
  return (data ?? []) as ShippingMethod[];
});

export interface CartShape {
  subtotal: number;
  totalWeightGrams: number;
  /** האם כל הפריטים זכאים למשלוח חינם */
  freeShippingEligible: boolean;
}

function withinDates(method: ShippingMethod, now: Date): boolean {
  const from = method.valid_from ? new Date(method.valid_from) : null;
  const until = method.valid_until ? new Date(method.valid_until) : null;
  return (!from || from <= now) && (!until || until >= now);
}

function withinLimits(method: ShippingMethod, cart: CartShape): boolean {
  if (method.min_weight_grams != null && cart.totalWeightGrams < method.min_weight_grams) return false;
  if (method.max_weight_grams != null && cart.totalWeightGrams > method.max_weight_grams) return false;
  if (method.min_total != null && cart.subtotal < method.min_total) return false;
  if (method.max_total != null && cart.subtotal > method.max_total) return false;
  return true;
}

/** מחיר שיטה לעגלה נתונה, אחרי סף משלוח חינם (של השיטה או של החנות). */
export function priceForMethod(
  method: ShippingMethod,
  cart: CartShape,
  settings: Pick<StoreSettings, 'free_shipping_threshold'>,
): number {
  if (method.kind === 'pickup') return 0;

  const threshold = method.free_over ?? settings.free_shipping_threshold;
  if (
    threshold != null &&
    cart.freeShippingEligible &&
    cart.subtotal >= threshold
  ) {
    return 0;
  }
  return round2(method.price);
}

export interface AvailableMethod {
  method: ShippingMethod;
  price: number;
}

/** השיטות המוצגות ב-Checkout — מסוננות לתוקף ולמגבלות העגלה. */
export async function getAvailableMethods(
  cart: CartShape,
  settings: Pick<StoreSettings, 'free_shipping_threshold' | 'pickup_enabled'>,
  now: Date = new Date(),
): Promise<AvailableMethod[]> {
  const methods = await getShippingMethods();
  return methods
    .filter((method) => withinDates(method, now))
    .filter((method) => (method.kind === 'pickup' ? settings.pickup_enabled : true))
    .filter((method) => method.kind === 'pickup' || withinLimits(method, cart))
    .map((method) => ({ method, price: priceForMethod(method, cart, settings) }));
}

/** "עוד X ₪ למשלוח חינם" — null כשאין סף או שכבר עברו אותו. */
export function amountToFreeShipping(
  cart: CartShape,
  settings: Pick<StoreSettings, 'free_shipping_threshold'>,
): number | null {
  const threshold = settings.free_shipping_threshold;
  if (threshold == null || !cart.freeShippingEligible) return null;
  const remaining = round2(threshold - cart.subtotal);
  return remaining > 0 ? remaining : null;
}
