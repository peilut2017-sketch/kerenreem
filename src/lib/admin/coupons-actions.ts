'use server';

import { revalidatePath } from 'next/cache';
import { assertScreenPermission } from './auth';
import { writeAuditLog } from './audit';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ניהול קופונים (פרק 12): יצירה, הפעלה/כיבוי. admin בלבד — נאכף גם
 * ב-RLS (coupons_admin_write). הקוד נשמר uppercase, בהתאם לאילוץ במסד.
 */

export interface CouponInput {
  code: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  minTotal: number | null;
  minQuantity: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  endsAt: string | null;
  restrictedContact: string | null;
  combinableWithSale: boolean;
  combinableWithCoupons: boolean;
  /** [1.4] תחולה — כמו במבצעים: ריק בשניהם = כל האתר */
  categoryIds: string[];
  bookIds: string[];
  excludeBookIds: string[];
}

/**
 * [1.4] יצירה/עדכון קופון — פונקציה אחת ל-upsert (לפי couponId ריק/מלא),
 * כך שאין יותר טופס עריכה חלקי שמאפס שדות שאינו רואה. `active` נשאר
 * מנוהל בנפרד (setCouponActive) ואינו נכתב כאן בעריכה, כדי שעריכת קופון
 * כבוי לא תדליק אותו בטעות.
 */
export async function saveCoupon(
  couponId: string | null,
  input: CouponInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await assertScreenPermission('coupons', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(code)) {
    return { ok: false, error: 'קוד: 3–30 תווים — אותיות לטיניות, ספרות ומקפים' };
  }
  if (input.kind === 'percent' && !(input.value > 0 && input.value <= 100)) {
    return { ok: false, error: 'אחוז הנחה: בין 1 ל-100' };
  }
  if (input.kind === 'fixed' && !(input.value > 0)) {
    return { ok: false, error: 'סכום הנחה חייב להיות חיובי' };
  }

  const hasScope = input.categoryIds.length > 0 || input.bookIds.length > 0;
  const row = {
    code,
    kind: input.kind,
    value: input.kind === 'free_shipping' ? 0 : input.value,
    min_total: input.minTotal,
    min_quantity: input.minQuantity,
    max_uses: input.maxUses,
    max_uses_per_customer: input.maxUsesPerCustomer || 1,
    ends_at: input.endsAt,
    combinable_with_sale: input.combinableWithSale,
    combinable_with_coupons: input.combinableWithCoupons,
    restricted_contact: input.restrictedContact,
    applies_to: hasScope
      ? { category_ids: input.categoryIds, book_ids: input.bookIds, exclude_book_ids: input.excludeBookIds }
      : { exclude_book_ids: input.excludeBookIds },
  };

  const { error } = couponId
    ? await service.from('coupons').update(row).eq('id', couponId)
    : await service.from('coupons').insert({ ...row, active: true, created_by: session.userId });

  if (error) {
    if (error.code === '23505') return { ok: false, error: 'הקוד כבר קיים' };
    return { ok: false, error: `השמירה נכשלה: ${error.message}` };
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: couponId ? 'update' : 'insert',
      table_name: 'coupons',
      record_id: couponId ?? undefined,
      new_values: { code, kind: input.kind, value: input.value },
    });
  }
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function setCouponActive(couponId: string, active: boolean): Promise<void> {
  const session = await assertScreenPermission('coupons', 'edit');
  if ('error' in session) return;
  const supabase = await createClient();
  if (!supabase) return;
  await supabase.from('coupons').update({ active }).eq('id', couponId);
  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'coupons',
    record_id: couponId,
    new_values: { active },
  });
  revalidatePath('/admin/coupons');
}

/**
 * [1.3] מחיקת קופון: בלי מימושים — נמחק; עם מימושים — מושבת בלבד
 * (ההיסטוריה החשבונאית נשמרת, unique ההזמנות מפנה אליו).
 */
export async function deleteCoupon(couponId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await assertScreenPermission('coupons', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { count } = await service
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId);
  if ((count ?? 0) > 0) {
    await service.from('coupons').update({ active: false }).eq('id', couponId);
    await writeAuditLog(null, session.userId, 'coupon_disable', 'coupons', couponId, {
      context: 'השבתת קופון עם מימושים (במקום מחיקה)',
    });
    revalidatePath('/admin/coupons');
    return { ok: true, error: 'לקופון מימושים — הושבת במקום להימחק (ההיסטוריה נשמרת)' };
  }
  const { error } = await service.from('coupons').delete().eq('id', couponId);
  if (error) return { ok: false, error: error.message };
  await writeAuditLog(null, session.userId, 'coupon_delete', 'coupons', couponId, {
    context: 'מחיקת קופון (ללא מימושים)',
  });
  revalidatePath('/admin/coupons');
  return { ok: true };
}

/** [1.3] מבצע אוטומטי — יצירה/עדכון (upsert לפי id ריק/מלא). */
export async function savePromotion(
  promotionId: string | null,
  input: {
    name: string;
    kind: 'percent' | 'fixed';
    value: number;
    scopeAll: boolean;
    categoryIds: string[];
    bookIds: string[];
    excludeBookIds: string[];
    minTotal: number | null;
    minQuantity: number | null;
    combinableWithCoupon: boolean;
    startsAt: string | null;
    endsAt: string | null;
    active: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const session = await assertScreenPermission('coupons', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  if (!input.name.trim()) return { ok: false, error: 'שם המבצע חסר' };
  if (!(input.value > 0)) return { ok: false, error: 'ערך ההנחה חייב להיות חיובי' };
  if (input.kind === 'percent' && input.value > 100) return { ok: false, error: 'אחוז מעל 100' };
  if (!input.scopeAll && input.categoryIds.length === 0 && input.bookIds.length === 0) {
    return { ok: false, error: 'בחרו תחולה: כל האתר, קטגוריות או ספרים' };
  }
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const row = {
    name: input.name.trim().slice(0, 120),
    kind: input.kind,
    value: input.value,
    scope: input.scopeAll
      ? { all: true, exclude_book_ids: input.excludeBookIds }
      : {
          category_ids: input.categoryIds,
          book_ids: input.bookIds,
          exclude_book_ids: input.excludeBookIds,
        },
    min_total: input.minTotal,
    min_quantity: input.minQuantity,
    combinable_with_coupon: input.combinableWithCoupon,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    active: input.active,
  };
  // created_by נכתב רק ביצירה — עריכה לא דורסת את מזהה היוצר המקורי
  const { error } = promotionId
    ? await service.from('promotions').update(row).eq('id', promotionId)
    : await service.from('promotions').insert({ ...row, created_by: session.userId });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function deletePromotion(promotionId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await assertScreenPermission('coupons', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };
  const { error } = await service.from('promotions').delete().eq('id', promotionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/coupons');
  return { ok: true };
}
