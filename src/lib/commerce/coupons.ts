import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { round2 } from './pricing';
import { hashContact } from './guest-token';
import type { ValidatedCart } from './cart';

/**
 * קופונים (פרק 12 במסמך האב, מודל 3.14): האימות בצד השרת בלבד —
 * הטבלה אינה קריאה ללקוחות (מניעת קצירת קודים), והמימוש נרשם ביצירת
 * ההזמנה. סדר החישוב: מחיר מבצע קודם (כבר בתוך המחיר בעגלה), קופון
 * אחריו; קופון אינו חל על ספר במבצע אלא אם combinable_with_sale.
 */

export interface CouponRow {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  min_total: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_customer: number;
  first_order_only: boolean;
  applies_to: {
    book_ids?: string[];
    category_ids?: string[];
    exclude_book_ids?: string[];
  };
  combinable_with_sale: boolean;
  active: boolean;
}

export type CouponError =
  | 'invalid'
  | 'min_total'
  | 'used_up'
  | 'not_applicable';

export interface CouponResult {
  ok: boolean;
  error?: CouponError;
  minTotal?: number;
  coupon?: CouponRow;
  /** הנחת סכום על ההזמנה (0 לקופון משלוח חינם) */
  discountAmount: number;
  freeShipping: boolean;
}

const NO_COUPON: CouponResult = { ok: false, discountAmount: 0, freeShipping: false };

/** שורות העגלה שהקופון חל עליהן — מחריג ספרים מוחרגים ומבצעים לא-ניתנים-לשילוב. */
function eligibleAmount(cart: ValidatedCart, coupon: CouponRow): number {
  const applies = coupon.applies_to ?? {};
  const lines = cart.lines.filter((line) => {
    if (line.removedReason !== null) return false;
    if (applies.exclude_book_ids?.includes(line.bookId)) return false;
    if (applies.book_ids && applies.book_ids.length > 0 && !applies.book_ids.includes(line.bookId)) {
      return false;
    }
    if (line.onSale && !coupon.combinable_with_sale) return false;
    return true;
  });
  return round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
}

export async function validateCoupon(
  code: string,
  cart: ValidatedCart,
  contactPhone?: string | null,
): Promise<CouponResult> {
  const service = createServiceClient();
  if (!service) return NO_COUPON;

  const normalized = code.trim().toUpperCase();
  if (!normalized) return { ...NO_COUPON, error: 'invalid' };

  const { data: coupon } = await service
    .from('coupons')
    .select('*')
    .eq('code', normalized)
    .eq('active', true)
    .maybeSingle();
  if (!coupon) return { ...NO_COUPON, error: 'invalid' };

  const now = new Date();
  if (coupon.starts_at && new Date(coupon.starts_at) > now) return { ...NO_COUPON, error: 'invalid' };
  if (coupon.ends_at && new Date(coupon.ends_at) < now) return { ...NO_COUPON, error: 'invalid' };

  // מגבלות שימוש — נספרות מהמימושים בפועל, לא ממונה שיכול להתפזר
  const { count: totalUses } = await service
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', coupon.id);
  if (coupon.max_uses != null && (totalUses ?? 0) >= coupon.max_uses) {
    return { ...NO_COUPON, error: 'used_up' };
  }
  if (contactPhone) {
    const { count: customerUses } = await service
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .eq('contact_hash', hashContact(contactPhone));
    if ((customerUses ?? 0) >= coupon.max_uses_per_customer) {
      return { ...NO_COUPON, error: 'used_up' };
    }
  }

  if (coupon.min_total != null && cart.subtotal < coupon.min_total) {
    return { ...NO_COUPON, error: 'min_total', minTotal: coupon.min_total };
  }

  const typedCoupon = coupon as CouponRow;
  if (typedCoupon.kind === 'free_shipping') {
    return { ok: true, coupon: typedCoupon, discountAmount: 0, freeShipping: true };
  }

  const base = eligibleAmount(cart, typedCoupon);
  if (base <= 0) return { ...NO_COUPON, error: 'not_applicable' };

  const discount =
    typedCoupon.kind === 'percent'
      ? round2((base * typedCoupon.value) / 100)
      : Math.min(round2(typedCoupon.value), base);

  return { ok: true, coupon: typedCoupon, discountAmount: discount, freeShipping: false };
}

/** רישום המימוש בעת יצירת ההזמנה — unique(coupon, order) מונע כפילות. */
export async function recordRedemption(
  service: SupabaseClient,
  input: {
    couponId: string;
    orderId: string;
    customerId: string | null;
    contactPhone: string;
    amountDiscounted: number;
  },
): Promise<void> {
  const { error } = await service.from('coupon_redemptions').insert({
    coupon_id: input.couponId,
    order_id: input.orderId,
    customer_id: input.customerId,
    contact_hash: hashContact(input.contactPhone),
    amount_discounted: input.amountDiscounted,
  });
  if (error && error.code !== '23505') {
    console.error('[commerce:coupons] redemption', error.message);
  }
}
