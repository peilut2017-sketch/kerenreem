import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { round2 } from './pricing';
import type { ValidatedCart } from './cart';
import type { Promotion } from '@/lib/supabase/types';

/**
 * [1.3] מבצעים אוטומטיים (בקשת בעל האתר): הנחה כלל-אתרית / קטגוריה /
 * ספרים מסוימים (עם החרגות), בתנאי מינימום יחידות או סכום — חלה מעצמה
 * בעגלה, בלי קוד קופון. סדר החישוב (פרק 12): מחיר מבצע של הספר כבר
 * בתוך המחיר → מבצע אוטומטי → קופון. מוחל מבצע אחד: בעל העדיפות
 * הגבוהה ביותר שנותן את ההנחה הגדולה ביותר.
 */

export interface PromotionResult {
  promotion: Pick<Promotion, 'id' | 'name' | 'kind' | 'value' | 'combinable_with_coupon'>;
  discountAmount: number;
}

/** השורות שהמבצע חל עליהן — לפי התחולה, בניכוי החרגות. */
function eligibleAmountAndUnits(
  cart: ValidatedCart,
  promo: Promotion,
): { amount: number; units: number } {
  const scope = promo.scope ?? {};
  const lines = cart.lines.filter((line) => {
    if (line.removedReason !== null) return false;
    if (scope.exclude_book_ids?.includes(line.bookId)) return false;
    if (scope.all) return true;
    if (scope.book_ids?.length && scope.book_ids.includes(line.bookId)) return true;
    if (scope.category_ids?.length && line.categoryId && scope.category_ids.includes(line.categoryId)) {
      return true;
    }
    return false;
  });
  return {
    amount: round2(lines.reduce((sum, line) => sum + line.lineTotal, 0)),
    units: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** המבצע הפעיל הטוב ביותר לעגלה — או null. אימות מלא בשרת בלבד. */
export async function findBestPromotion(cart: ValidatedCart): Promise<PromotionResult | null> {
  if (cart.totalQuantity === 0) return null;
  const service = createServiceClient();
  if (!service) return null;

  const nowIso = new Date().toISOString();
  const { data: promotions } = await service
    .from('promotions')
    .select('*')
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('priority', { ascending: false })
    .limit(20);
  if (!promotions || promotions.length === 0) return null;

  let best: PromotionResult | null = null;
  for (const promo of promotions as Promotion[]) {
    const { amount, units } = eligibleAmountAndUnits(cart, promo);
    if (amount <= 0) continue;
    if (promo.min_total != null && cart.subtotal < promo.min_total) continue;
    if (promo.min_quantity != null && units < promo.min_quantity) continue;

    const discount =
      promo.kind === 'percent'
        ? round2((amount * promo.value) / 100)
        : Math.min(round2(promo.value), amount);
    if (discount <= 0) continue;

    if (
      !best ||
      discount > best.discountAmount ||
      (discount === best.discountAmount && promo.priority > 0)
    ) {
      best = {
        promotion: {
          id: promo.id,
          name: promo.name,
          kind: promo.kind,
          value: promo.value,
          combinable_with_coupon: promo.combinable_with_coupon,
        },
        discountAmount: discount,
      };
    }
  }
  return best;
}
