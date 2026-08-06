import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { CouponsManager, type AdminCoupon } from '@/components/admin/orders/CouponsManager';

export const dynamic = 'force-dynamic';

/**
 * ניהול קופונים (פרק 12 באפיון). המימושים נספרים מ-coupon_redemptions —
 * אין מונה שיכול להתפזר. ההפעלה בפועל בצד הלקוח כפופה לדגל coupons_enabled.
 */
export default async function AdminCouponsPage() {
  await requirePermission('finance');
  const supabase = await createClient();

  let coupons: AdminCoupon[] = [];
  if (supabase) {
    const [{ data: rows }, { data: redemptions }] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('coupon_redemptions').select('coupon_id'),
    ]);
    const counts = new Map<string, number>();
    for (const redemption of redemptions ?? []) {
      counts.set(redemption.coupon_id, (counts.get(redemption.coupon_id) ?? 0) + 1);
    }
    coupons = (rows ?? []).map((row) => ({
      id: row.id,
      code: row.code,
      kind: row.kind,
      value: Number(row.value),
      minTotal: row.min_total != null ? Number(row.min_total) : null,
      endsAt: row.ends_at,
      maxUses: row.max_uses,
      active: row.active,
      uses: counts.get(row.id) ?? 0,
    }));
  }

  return (
    <>
      <AdminHeader
        title="קופונים"
        description="אחוז, סכום קבוע או משלוח חינם. האימות תמיד בצד השרת; ההצגה ללקוחות כפופה לדגל הקופונים בהגדרות החנות."
      />
      <CouponsManager coupons={coupons} />
    </>
  );
}
