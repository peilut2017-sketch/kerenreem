import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { round2 } from './pricing';
import { hashContact, legacyHashContact } from './guest-token';
import { normalizePhone } from './phone';
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
  /** [1.1] "ניתן לצירוף עם קופונים נוספים" — ברירת מחדל לא (מודל 3.14) */
  combinable_with_coupons: boolean;
  /** [1.3] מינימום יחידות זכאיות ("קנה X ומעלה") */
  min_quantity: number | null;
  /** [1.3] קופון אישי: טלפון מנורמל או מייל; null = פתוח לכולם */
  restricted_contact: string | null;
  active: boolean;
}

export type CouponError =
  | 'invalid'
  | 'min_total'
  | 'used_up'
  | 'not_applicable'
  /** [1.1] קופון קיים או חדש אינו מסומן "ניתן לצירוף" (ברירת מחדל: לא) */
  | 'not_combinable';

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

/**
 * שורות העגלה שהקופון חל עליהן — מחריג ספרים מוחרגים ומבצעים
 * לא-ניתנים-לשילוב. [1.4] תחולה לפי ספרים ו/או קטגוריות (כמו
 * findBestPromotion): בלי book_ids/category_ids מוגדרים — כל העגלה;
 * עם הגדרה — שורה זכאית אם היא בספרים המפורשים *או* בקטגוריה המפורשת.
 */
function eligibleAmount(cart: ValidatedCart, coupon: CouponRow): number {
  const applies = coupon.applies_to ?? {};
  const hasScope = Boolean(applies.book_ids?.length) || Boolean(applies.category_ids?.length);
  const lines = cart.lines.filter((line) => {
    if (line.removedReason !== null) return false;
    if (applies.exclude_book_ids?.includes(line.bookId)) return false;
    if (line.onSale && !coupon.combinable_with_sale) return false;
    if (!hasScope) return true;
    const inBooks = applies.book_ids?.includes(line.bookId) ?? false;
    const inCategory = Boolean(line.categoryId) && (applies.category_ids?.includes(line.categoryId as string) ?? false);
    return inBooks || inCategory;
  });
  return round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));
}

export async function validateCoupon(
  code: string,
  cart: ValidatedCart,
  contactPhone?: string | null,
  contactEmail?: string | null,
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
    // השוואה כפולה (HMAC + hash ישן) — תקופת המעבר של סעיף 6 בסבב 1.1
    const { count: customerUses } = await service
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)
      .in('contact_hash', [hashContact(contactPhone), legacyHashContact(contactPhone)]);
    if ((customerUses ?? 0) >= coupon.max_uses_per_customer) {
      return { ...NO_COUPON, error: 'used_up' };
    }
  }

  if (coupon.min_total != null && cart.subtotal < coupon.min_total) {
    return { ...NO_COUPON, error: 'min_total', minTotal: coupon.min_total };
  }
  // [1.3] "קנה X יחידות ומעלה"
  if (coupon.min_quantity != null && cart.totalQuantity < coupon.min_quantity) {
    return { ...NO_COUPON, error: 'min_total', minTotal: coupon.min_total ?? undefined };
  }
  // [1.3] קופון אישי — מזוהה מול טלפון/מייל ההזמנה; בלי פרטי קשר (עגלה)
  // או בלי התאמה — נדחה בהודעה גנרית (לא מדליפים למי הקופון שייך)
  if (coupon.restricted_contact) {
    const target = String(coupon.restricted_contact).trim().toLowerCase();
    const phoneMatch = contactPhone ? normalizePhone(contactPhone) === normalizePhone(target) : false;
    const emailMatch = contactEmail ? contactEmail.trim().toLowerCase() === target : false;
    if (!phoneMatch && !emailMatch) return { ...NO_COUPON, error: 'invalid' };
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

/**
 * רישום המימוש בעת יצירת ההזמנה — unique(coupon, order) מונע כפילות.
 * ‏23505 (מימוש כפול לאותה הזמנה) ו-23514 (טריגר תקרת השימוש, מיגרציה 54,
 * כשקופון גלש על תקרתו במירוץ בין שתי הזמנות מקבילות) הם תוצאות צפויות
 * ולא כשל — ההזמנה כבר נוצרה, והקופון נשאר חסום נכון במסד.
 */
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
  if (error && error.code !== '23505' && error.code !== '23514') {
    console.error('[commerce:coupons] redemption', error.message);
  }
}
