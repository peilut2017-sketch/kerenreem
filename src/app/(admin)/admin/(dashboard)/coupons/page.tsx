import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { CouponsManager, type AdminCoupon } from '@/components/admin/orders/CouponsManager';
import { PromotionsManager, type PromotionOption } from '@/components/admin/orders/PromotionsManager';
import type { Promotion } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * ניהול קופונים (פרק 12 באפיון). המימושים נספרים מ-coupon_redemptions —
 * אין מונה שיכול להתפזר. ההפעלה בפועל בצד הלקוח כפופה לדגל coupons_enabled.
 */
export default async function AdminCouponsPage() {
  await requirePermission('finance');
  const supabase = await createClient();

  let coupons: AdminCoupon[] = [];
  let promotions: Promotion[] = [];
  let categories: PromotionOption[] = [];
  let books: PromotionOption[] = [];
  if (supabase) {
    const [{ data: rows }, { data: redemptions }, promosRes, categoriesRes, booksRes] = await Promise.all([
      supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      supabase.from('coupon_redemptions').select('coupon_id'),
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name_he').order('sort_order'),
      supabase.from('books').select('id, title_he').eq('is_purchasable', true).order('title_he'),
    ]);
    promotions = (promosRes.data ?? []) as Promotion[];
    categories = (categoriesRes.data ?? []).map((c) => ({ id: c.id, label: c.name_he }));
    books = (booksRes.data ?? []).map((b) => ({ id: b.id, label: b.title_he }));
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
      minQuantity: row.min_quantity != null ? Number(row.min_quantity) : null,
      restrictedContact: row.restricted_contact,
    }));
  }

  return (
    <>
      <AdminHeader
        title="קופונים"
        description="אחוז, סכום קבוע או משלוח חינם. האימות תמיד בצד השרת; ההצגה ללקוחות כפופה לדגל הקופונים בהגדרות החנות."
      />
      <CouponsManager coupons={coupons} />
      <PromotionsManager promotions={promotions} categories={categories} books={books} />
    </>
  );
}
