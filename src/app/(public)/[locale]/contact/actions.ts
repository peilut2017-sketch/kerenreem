'use server';

import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';

/**
 * הגבלת קצב בזיכרון התהליך.
 *
 * מלכודת הבוטים (השדה המוסתר) עוצרת סורקים פשוטים, אבל לא כלי שנכתב מול
 * הטופס הזה. בלי הגבלה כלשהי אפשר להזרים אלפי פניות לטבלה בדקה.
 *
 * מכוון: זו הגנה חלקית ולא מלאה. הזיכרון אינו משותף בין מופעים, ולכן
 * בפריסה ללא שרת (Vercel) כל מופע סופר לעצמו, והמונה מתאפס בהתחלה קרה.
 * זה עדיין חוסם את המקרה הנפוץ — סקריפט יחיד ששולח בלולאה — בעלות אפס
 * ובלי תלות חיצונית. הגנה אמיתית דורשת מונה משותף (Upstash/Redis) או
 * שכבת WAF, וזו החלטה שכדאי לקבל כשיהיה נפח אמיתי.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  // ניקוי עצלן: בלעדיו המפה גדלה לצמיתות עם כל כתובת שפנתה אי־פעם.
  if (hits.size > 5000) {
    for (const [entry, times] of hits) {
      if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(entry);
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

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

  // מזהה הפונה לצורך הגבלת הקצב. x-forwarded-for נשלט על ידי הלקוח ואינו
  // ראיה קבילה לזהות — אבל כאן הוא לא משמש להרשאה, רק לספירה, ולכן די בו.
  const requestHeaders = await headers();
  const ip =
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    requestHeaders.get('x-real-ip') ||
    'unknown';

  if (rateLimited(ip)) {
    return { status: 'error', message: t('tooMany') };
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
