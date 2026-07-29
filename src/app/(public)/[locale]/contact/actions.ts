'use server';

import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

export interface ContactFormState {
  status: 'idle' | 'success' | 'error';
  /** מפתח שדה → הודעת שגיאה מתורגמת */
  fieldErrors?: Record<string, string>;
  message?: string;
}

const MAX = { name: 120, email: 160, phone: 40, subject: 160, message: 4000 };

export async function submitContact(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const t = await getTranslations('contact');

  // מלכודת בוטים: שדה מוסתר שמשתמש אנושי לא רואה ולא ממלא.
  // מגיבים בהצלחה מדומה כדי לא ללמד את הבוט מה נכשל.
  if (String(formData.get('website') ?? '').trim() !== '') {
    return { status: 'success' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  const consent = formData.get('consent') === 'on';

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = t('required');
  if (!message) fieldErrors.message = t('required');
  if (!email) fieldErrors.email = t('required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fieldErrors.email = t('invalidEmail');
  if (!consent) fieldErrors.consent = t('consentRequired');

  for (const [key, limit] of Object.entries(MAX)) {
    const value = { name, email, phone, subject, message }[key as keyof typeof MAX];
    if (value.length > limit) fieldErrors[key] = t('error');
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', fieldErrors };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { status: 'error', message: t('error') };
  }

  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    phone: phone || null,
    subject: subject || null,
    message,
  });

  if (error) {
    console.error('[contact] insert failed', error);
    return { status: 'error', message: t('error') };
  }

  return { status: 'success' };
}
