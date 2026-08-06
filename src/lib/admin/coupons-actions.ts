'use server';

import { revalidatePath } from 'next/cache';
import { assertRole } from './auth';
import { createClient } from '@/lib/supabase/server';

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
  const session = await assertRole('admin');
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
  const session = await assertRole('admin');
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
