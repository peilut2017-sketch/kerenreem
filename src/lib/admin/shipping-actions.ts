'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { createClient } from '@/lib/supabase/server';

/**
 * ניהול שיטות אספקה (פרק 11): עדכון מחיר, זמן, מגבלות ותוקף. admin
 * בלבד (RLS: shipping_methods_admin_write). מחירי משלוח הם נתון כספי —
 * כל שינוי מתועד ב-audit.
 */

export interface ShippingFormState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

function num(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveShippingMethod(
  _prev: ShippingFormState,
  formData: FormData,
): Promise<ShippingFormState> {
  const session = await assertPermission('finance');
  if ('error' in session) return { status: 'error', message: session.error };
  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const id = String(formData.get('id') ?? '');
  const patch: Record<string, unknown> = {
    name_he: String(formData.get('name_he') ?? '').trim(),
    name_en: String(formData.get('name_en') ?? '').trim() || null,
    price: num(formData, 'price') ?? 0,
    free_over: num(formData, 'free_over'),
    min_total: num(formData, 'min_total'),
    max_total: num(formData, 'max_total'),
    min_weight_grams: num(formData, 'min_weight_grams'),
    max_weight_grams: num(formData, 'max_weight_grams'),
    eta_business_days: num(formData, 'eta_business_days') ?? 3,
    active: formData.get('active') === 'on',
    sort_order: num(formData, 'sort_order') ?? 0,
  };
  if (!patch.name_he) return { status: 'error', message: 'שם השיטה חובה' };
  if ((patch.price as number) < 0) return { status: 'error', message: 'מחיר שלילי אינו חוקי' };

  let error;
  if (id) {
    ({ error } = await supabase.from('shipping_methods').update(patch).eq('id', id));
  } else {
    const slug = String(formData.get('slug') ?? '').trim().toLowerCase();
    if (!/^[a-z0-9-]{2,30}$/.test(slug)) {
      return { status: 'error', message: 'מזהה (slug): אותיות לטיניות קטנות, ספרות ומקפים' };
    }
    const kind = String(formData.get('kind') ?? 'flat');
    if (!['pickup', 'flat', 'by_weight', 'by_total', 'free_over'].includes(kind)) {
      return { status: 'error', message: 'סוג שיטה לא תקין' };
    }
    ({ error } = await supabase.from('shipping_methods').insert({ ...patch, slug, kind }));
  }

  if (error) {
    if (error.code === '23505') return { status: 'error', message: 'המזהה כבר קיים' };
    return { status: 'error', message: `השמירה נכשלה: ${error.message}` };
  }

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: id ? 'update' : 'insert',
    table_name: 'shipping_methods',
    record_id: id || null,
    new_values: patch,
  });
  revalidatePath('/admin/shipping');
  revalidatePath('/[locale]/cart', 'page');
  return { status: 'saved' };
}
