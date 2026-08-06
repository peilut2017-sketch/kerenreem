'use server';

import { revalidatePath } from 'next/cache';
import { assertRole } from './auth';
import { createClient } from '@/lib/supabase/server';

/**
 * שמירת הגדרות החנות (store_settings, שורה יחידה) — הדגלים השכבתיים
 * והתצורה הכספית/תפעולית. admin בלבד, דרך ה-RLS (store_settings_admin_write),
 * עם תיעוד audit. מתג-העל store_enabled נשאר בטופס הנפרד הקיים —
 * שמירה כאן אינה יכולה לכבות את החנות בטעות.
 */

export interface StoreConfigState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

const FLAG_FIELDS = [
  'show_prices',
  'cart_enabled',
  'checkout_enabled',
  'payments_enabled',
  'express_checkout_enabled',
  'coupons_enabled',
  'accounts_enabled',
  'returns_enabled',
  'recommendations_enabled',
  'donations_enabled',
  'pickup_enabled',
] as const;

function numberField(formData: FormData, name: string): number | null {
  const raw = String(formData.get(name) ?? '').trim();
  if (raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function saveStoreConfig(
  _prev: StoreConfigState,
  formData: FormData,
): Promise<StoreConfigState> {
  const session = await assertRole('admin');
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const patch: Record<string, unknown> = {};
  for (const flag of FLAG_FIELDS) {
    patch[flag] = formData.get(flag) === 'on';
  }

  patch.free_shipping_threshold = numberField(formData, 'free_shipping_threshold');
  const installmentsMin = numberField(formData, 'installments_min_total');
  if (installmentsMin != null) patch.installments_min_total = installmentsMin;
  const installmentsMax = numberField(formData, 'installments_max');
  if (installmentsMax != null) patch.installments_max = installmentsMax;

  const documentType = String(formData.get('document_type') ?? '');
  if (['invoice_receipt', 'receipt', 'donation_receipt'].includes(documentType)) {
    patch.document_type = documentType;
  }
  const vatMode = String(formData.get('vat_mode') ?? '');
  if (['included', 'exempt'].includes(vatMode)) patch.vat_mode = vatMode;
  const vatRate = numberField(formData, 'vat_rate');
  if (vatRate != null) patch.vat_rate = vatRate;

  for (const name of [
    'order_prep_days',
    'delivery_buffer_days',
    'pickup_prep_hours',
    'low_stock_threshold',
    'add_to_order_window_hours',
  ]) {
    const value = numberField(formData, name);
    if (value != null) patch[name] = value;
  }

  patch.support_phone = String(formData.get('support_phone') ?? '').trim() || null;
  patch.pickup_hours = String(formData.get('pickup_hours') ?? '').trim() || null;
  const pickupAddress = String(formData.get('pickup_address') ?? '').trim();
  patch.pickup_address = pickupAddress ? { text: pickupAddress } : {};

  const { error } = await supabase.from('store_settings').update(patch).eq('id', 1);
  if (error) return { status: 'error', message: `השמירה נכשלה: ${error.message}` };

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'store_settings',
    record_id: null,
    new_values: patch,
    context: 'הגדרות חנות',
  });

  revalidatePath('/admin/books/settings');
  revalidatePath('/[locale]/books/[slug]', 'page');
  revalidatePath('/[locale]/books', 'page');
  revalidatePath('/[locale]/cart', 'page');
  revalidatePath('/[locale]', 'layout');
  return { status: 'saved' };
}
