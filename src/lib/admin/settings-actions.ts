'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from './auth';
import type { UserRole } from '@/lib/supabase/types';

export interface SettingsState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

/**
 * שמירת הגדרות האתר. שורה יחידה (id=1), ולכן זו תמיד פעולת update.
 * מוגבל ל-admin: כאן נמצא דגל הפעלת החנות ופרטי הארגון המופיעים במסמכים
 * המשפטיים.
 */
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await assertRole('admin');
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const contact = {
    address_he: text(formData, 'address_he'),
    address_en: text(formData, 'address_en'),
    email: text(formData, 'email'),
    phone: text(formData, 'phone'),
    registration_number: text(formData, 'registration_number'),
    privacy_officer: text(formData, 'privacy_officer'),
    accessibility_officer: text(formData, 'accessibility_officer'),
  };

  const socialKeys = ['facebook', 'youtube', 'instagram', 'x'];
  const social_links = Object.fromEntries(
    socialKeys.map((key) => [key, text(formData, `social_${key}`)]).filter(([, value]) => value),
  );

  const { error } = await supabase
    .from('site_settings')
    .update({
      logo_url: text(formData, 'logo_url') || null,
      contact,
      social_links,
      store_enabled: formData.get('store_enabled') === 'on',
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);

  if (error) return { status: 'error', message: `השמירה נכשלה: ${error.message}` };

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'site_settings',
    record_id: null,
  });

  // הגדרות נצרכות בכל עמוד (כותרת, כותרת תחתונה) ולכן מרעננים את כל האתר.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');

  return { status: 'saved' };
}

/** שינוי תפקיד של איש צוות. Admin בלבד. */
export async function updateProfileRole(userId: string, role: UserRole): Promise<void> {
  const session = await assertRole('admin');
  if ('error' in session) return;

  // מנהל אינו יכול להוריד את עצמו — כך לא נוצר מצב שאין אף מנהל במערכת.
  if (session.userId === userId) return;

  const supabase = await createClient();
  if (!supabase) return;

  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) {
    console.error('[admin:role]', error);
    return;
  }

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'profiles',
    record_id: userId,
  });

  revalidatePath('/admin/settings');
}

/** סימון פנייה כטופלה. */
export async function setMessageHandled(id: string, handled: boolean): Promise<void> {
  const session = await assertRole('editor');
  if ('error' in session) return;

  const supabase = await createClient();
  if (!supabase) return;

  await supabase.from('contact_messages').update({ is_handled: handled }).eq('id', id);
  revalidatePath('/admin/messages');
}
