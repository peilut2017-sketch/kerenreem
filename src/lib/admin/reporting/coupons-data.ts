import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.5] ביצועי קופונים — האפיון היה מפורש: "לא להסתפק ב'השתמשו בקופון
 * 32 פעמים'". מרחיב את מונה השימושים הקיים ב-/admin/coupons בהכנסה
 * ובהנחה שנתנו בפועל. תמיד all-time (כמו מונה השימושים הקיים שם) —
 * לא טווח תאריכים, כדי לשקף ביצועים מצטברים מאז יצירת הקופון.
 *
 * מבצעים (promotions) אינם כלולים: בניגוד לקופונים, אין להם טבלת מימוש
 * ייעודית — הם מיושמים כחישוב מחיר בזמן אמת בלי רישום "איזו הזמנה
 * השתמשה באיזה מבצע". דורש התאמה נפרדת (שדה promotion_id על order_items,
 * למשל) לפני שאפשר לדווח עליהם באותה צורה.
 */

export interface CouponPerformance {
  id: string;
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  active: boolean;
  uses: number;
  totalDiscount: number;
  paidRevenue: number;
  aov: number;
}

export async function getCouponPerformance(): Promise<{ rows: CouponPerformance[]; error: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: true };

  const [{ data: coupons }, { data: redemptions }] = await Promise.all([
    supabase.from('coupons').select('id, code, kind, active').order('created_at', { ascending: false }),
    supabase.from('coupon_redemptions').select('coupon_id, order_id, amount_discounted').limit(20000),
  ]);

  const orderIds = [...new Set((redemptions ?? []).map((r) => r.order_id))];
  const paidTotalByOrderId = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, total, payment_state')
      .in('id', orderIds)
      .in('payment_state', ['paid', 'partially_refunded', 'refunded']);
    for (const order of orders ?? []) paidTotalByOrderId.set(order.id, Number(order.total));
  }

  const rows: CouponPerformance[] = (coupons ?? []).map((coupon) => {
    const couponRedemptions = (redemptions ?? []).filter((r) => r.coupon_id === coupon.id);
    const totalDiscount = couponRedemptions.reduce((sum, r) => sum + Number(r.amount_discounted ?? 0), 0);
    let paidRevenue = 0;
    let paidCount = 0;
    for (const r of couponRedemptions) {
      const total = paidTotalByOrderId.get(r.order_id);
      if (total != null) {
        paidRevenue += total;
        paidCount += 1;
      }
    }
    return {
      id: coupon.id,
      code: coupon.code,
      kind: coupon.kind,
      active: coupon.active,
      uses: couponRedemptions.length,
      totalDiscount,
      paidRevenue,
      aov: paidCount > 0 ? paidRevenue / paidCount : 0,
    };
  });

  return { rows: rows.sort((a, b) => b.uses - a.uses), error: false };
}
