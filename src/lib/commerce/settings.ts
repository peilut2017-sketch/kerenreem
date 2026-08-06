import 'server-only';
import { cache } from 'react';
import { createStaticClient } from '@/lib/supabase/server';
import type { StoreSettings } from '@/lib/supabase/types';
import { getSiteSettings } from '@/lib/data';

/**
 * הגדרות החנות והדגלים השכבתיים (store_settings, שורה יחידה).
 *
 * site_settings.store_enabled נשאר מתג-העל: כשהוא כבוי — כל הדגלים
 * האפקטיביים כבויים, יהיה ערכם בטבלה אשר יהיה. תחתיו הדגלים משורשרים:
 * שכבה פעילה רק כשכל השכבות שמתחתיה פעילות (checkout בלי cart אינו מצב).
 */

const DEFAULT_STORE_SETTINGS: StoreSettings = {
  id: 1,
  show_prices: false,
  cart_enabled: false,
  checkout_enabled: false,
  payments_enabled: false,
  express_checkout_enabled: false,
  coupons_enabled: false,
  accounts_enabled: false,
  returns_enabled: false,
  recommendations_enabled: false,
  donations_enabled: false,
  free_shipping_threshold: null,
  installments_min_total: 250,
  installments_max: 3,
  vat_mode: 'included',
  vat_rate: 18,
  document_type: 'invoice_receipt',
  order_prep_days: 1,
  delivery_buffer_days: 1,
  non_working_dates: [],
  pickup_enabled: true,
  pickup_address: {},
  pickup_hours: null,
  pickup_prep_hours: 24,
  support_phone: null,
  low_stock_threshold: 2,
  guest_link_ttl_days: 90,
  abandoned_after_minutes: 60,
  abandoned_retention_days: 90,
  add_to_order_window_hours: 12,
  updated_at: new Date(0).toISOString(),
};

export const getStoreSettings = cache(async (): Promise<StoreSettings> => {
  const supabase = createStaticClient();
  if (!supabase) return DEFAULT_STORE_SETTINGS;

  const { data, error } = await supabase
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[commerce:settings]', error.message);
    return DEFAULT_STORE_SETTINGS;
  }
  return { ...DEFAULT_STORE_SETTINGS, ...data } as StoreSettings;
});

export interface CommerceFlags {
  /** מתג-העל site_settings.store_enabled */
  storeEnabled: boolean;
  showPrices: boolean;
  cartEnabled: boolean;
  checkoutEnabled: boolean;
  paymentsEnabled: boolean;
  expressEnabled: boolean;
  couponsEnabled: boolean;
  accountsEnabled: boolean;
  returnsEnabled: boolean;
  donationsEnabled: boolean;
  recommendationsEnabled: boolean;
}

/** הדגלים האפקטיביים אחרי שרשור — הצרכנים קוראים רק אותם, לא את הגולמיים. */
export const getCommerceFlags = cache(async (): Promise<CommerceFlags> => {
  const [site, store] = await Promise.all([getSiteSettings(), getStoreSettings()]);
  const master = site.store_enabled;

  const showPrices = master && store.show_prices;
  const cartEnabled = showPrices && store.cart_enabled;
  const checkoutEnabled = cartEnabled && store.checkout_enabled;
  const paymentsEnabled = checkoutEnabled && store.payments_enabled;

  return {
    storeEnabled: master,
    showPrices,
    cartEnabled,
    checkoutEnabled,
    paymentsEnabled,
    expressEnabled: paymentsEnabled && store.express_checkout_enabled,
    couponsEnabled: checkoutEnabled && store.coupons_enabled,
    accountsEnabled: master && store.accounts_enabled,
    returnsEnabled: master && store.returns_enabled,
    donationsEnabled: checkoutEnabled && store.donations_enabled,
    recommendationsEnabled: master && store.recommendations_enabled,
  };
});
