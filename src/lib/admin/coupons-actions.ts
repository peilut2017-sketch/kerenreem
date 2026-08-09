'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * ניהול קופונים (פרק 12): יצירה, הפעלה/כיבוי. admin בלבד — נאכף גם
 * ב-RLS (coupons_admin_write). הקוד נשמר uppercase, בהתאם לאילוץ במסד.
 */

export interface CouponFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

export async function createCoupon(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  const session = await assertPermission('finance');
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,30}$/.test(code)) {
    return { status: 'error', message: 'קוד: 3–30 תווים — אותיות לטיניות, ספרות ומקפים' };
  }
  const kind = String(formData.get('kind') ?? '');
  if (!['percent', 'fixed', 'free_shipping'].includes(kind)) {
    return { status: 'error', message: 'סוג קופון לא תקין' };
  }
  const value = Number(formData.get('value') ?? 0);
  if (kind === 'percent' && !(value > 0 && value <= 100)) {
    return { status: 'error', message: 'אחוז הנחה: בין 1 ל-100' };
  }
  if (kind === 'fixed' && !(value > 0)) {
    return { status: 'error', message: 'סכום הנחה חייב להיות חיובי' };
  }

  const minTotalRaw = String(formData.get('min_total') ?? '').trim();
  const maxUsesRaw = String(formData.get('max_uses') ?? '').trim();
  const endsAtRaw = String(formData.get('ends_at') ?? '').trim();

  const { error } = await supabase.from('coupons').insert({
    code,
    kind,
    value: kind === 'free_shipping' ? 0 : value,
    min_total: minTotalRaw ? Number(minTotalRaw) : null,
    max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
    max_uses_per_customer: Number(formData.get('max_uses_per_customer') ?? 1) || 1,
    ends_at: endsAtRaw ? new Date(`${endsAtRaw}T23:59:59`).toISOString() : null,
    combinable_with_sale: formData.get('combinable_with_sale') === 'on',
    combinable_with_coupons: formData.get('combinable_with_coupons') === 'on',
    min_quantity: (() => { const raw = String(formData.get('min_quantity') ?? '').trim(); return raw === '' ? null : Number(raw); })(),
    restricted_contact: String(formData.get('restricted_contact') ?? '').trim().toLowerCase() || null,
    active: true,
    created_by: session.userId,
  });

  if (error) {
    if (error.code === '23505') return { status: 'error', message: 'הקוד כבר קיים' };
    return { status: 'error', message: `היצירה נכשלה: ${error.message}` };
  }

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'insert',
    table_name: 'coupons',
    new_values: { code, kind, value },
  });
  revalidatePath('/admin/coupons');
  return { status: 'saved' };
}

export async function setCouponActive(couponId: string, active: boolean): Promise<void> {
  const session = await assertPermission('finance');
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

/** [1.3] עדכון קופון קיים — אותם שדות כמו ביצירה. */
export async function updateCoupon(
  couponId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const num = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw === '' ? null : Number(raw);
  };
  const patch = {
    kind: String(formData.get('kind') ?? 'percent'),
    value: num('value') ?? 0,
    min_total: num('min_total'),
    min_quantity: num('min_quantity'),
    max_uses: num('max_uses'),
    max_uses_per_customer: num('max_uses_per_customer') ?? 1,
    starts_at: String(formData.get('starts_at') ?? '').trim() || null,
    ends_at: String(formData.get('ends_at') ?? '').trim() || null,
    combinable_with_sale: formData.get('combinable_with_sale') === 'on',
    combinable_with_coupons: formData.get('combinable_with_coupons') === 'on',
    restricted_contact: String(formData.get('restricted_contact') ?? '').trim().toLowerCase() || null,
  };
  const { error } = await service.from('coupons').update(patch).eq('id', couponId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/coupons');
  return { ok: true };
}

/**
 * [1.3] מחיקת קופון: בלי מימושים — נמחק; עם מימושים — מושבת בלבד
 * (ההיסטוריה החשבונאית נשמרת, unique ההזמנות מפנה אליו).
 */
export async function deleteCoupon(couponId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { count } = await service
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('coupon_id', couponId);
  if ((count ?? 0) > 0) {
    await service.from('coupons').update({ active: false }).eq('id', couponId);
    revalidatePath('/admin/coupons');
    return { ok: true, error: 'לקופון מימושים — הושבת במקום להימחק (ההיסטוריה נשמרת)' };
  }
  const { error } = await service.from('coupons').delete().eq('id', couponId);
  if (error) return { ok: false, error: error.message };
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
  const session = await assertPermission('finance');
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
    created_by: session.userId,
  };
  const { error } = promotionId
    ? await service.from('promotions').update(row).eq('id', promotionId)
    : await service.from('promotions').insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/coupons');
  return { ok: true };
}

export async function deletePromotion(promotionId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };
  const { error } = await service.from('promotions').delete().eq('id', promotionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/coupons');
  return { ok: true };
}
