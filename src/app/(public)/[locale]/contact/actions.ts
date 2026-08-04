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

/** מראה בטופס (ContactAttachmentsField) — נבדק כאן שוב כי אימות בדפדפן אפשר לעקוף. */
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;

interface ParsedAttachment {
  path: string;
  name: string;
  size: number;
  type: string;
}

/** קורא ומאמת את שדה attachments (JSON שכתב ContactAttachmentsField). לעולם לא זורק — קלט לא תקין הופך לרשימה ריקה. */
function parseAttachments(raw: FormDataEntryValue | null): ParsedAttachment[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is ParsedAttachment =>
          item &&
          typeof item.path === 'string' &&
          typeof item.name === 'string' &&
          typeof item.size === 'number' &&
          typeof item.type === 'string' &&
          item.size > 0 &&
          item.size <= MAX_ATTACHMENT_BYTES,
      )
      .slice(0, MAX_ATTACHMENTS);
  } catch {
    return [];
  }
}

/**
 * אימות מול Google, פעיל רק כששני המפתחות מוגדרים (site key בצד הלקוח,
 * secret כאן) — אותו דפדוף כמו GA4: בלי הגדרה, הקאפצ'ה פשוט לא נאכפת,
 * במקום להפיל את הטופס על שדה שלא קיים אצל מי שלא הגדיר ספק.
 */
const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const captchaEnabled = Boolean(RECAPTCHA_SECRET_KEY && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);

async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: RECAPTCHA_SECRET_KEY!, response: token, remoteip: ip }),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error('[contact] captcha verify failed', error);
    return false;
  }
}

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
  const topicId = String(formData.get('topic_id') ?? '').trim();
  const consent = formData.get('consent') === 'on';
  const attachments = parseAttachments(formData.get('attachments'));

  const supabase = await createClient();
  if (!supabase) {
    return { status: 'error', message: t('error') };
  }

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

  // שדות מותאמים (ניהול → פניות מהאתר → שדות מותאמים): נשלפים כאן מחדש
  // ולא מסופקים על ידי הלקוח, כדי שרשימת המפתחות שנכתבים ל-jsonb תיקבע
  // תמיד לפי מה שמוגדר במסד כרגע — לא לפי מה שהטופס בדפדפן "חשב" שקיים.
  const { data: activeFields } = await supabase
    .from('contact_fields')
    .select('id, field_type, is_required')
    .eq('is_published', true);

  const customFieldValues: Record<string, string | boolean> = {};
  for (const customField of activeFields ?? []) {
    const key = `custom_${customField.id}`;
    if (customField.field_type === 'checkbox') {
      const checked = formData.get(key) === 'on';
      customFieldValues[customField.id] = checked;
      if (customField.is_required && !checked) fieldErrors[key] = t('required');
      continue;
    }

    const value = String(formData.get(key) ?? '').trim();
    if (customField.is_required && !value) fieldErrors[key] = t('required');
    else if (value) customFieldValues[customField.id] = value;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', fieldErrors };
  }

  if (captchaEnabled) {
    const token = String(formData.get('g-recaptcha-response') ?? '');
    if (!token || !(await verifyCaptcha(token, ip))) {
      return { status: 'error', message: t('captchaRequired') };
    }
  }

  const { error } = await supabase.from('contact_messages').insert({
    name,
    email,
    phone: phone || null,
    subject: subject || null,
    message,
    attachments,
    topic_id: topicId || null,
    custom_field_values: customFieldValues,
  });

  if (error) {
    console.error('[contact] insert failed', error);
    return { status: 'error', message: t('error') };
  }

  return { status: 'success' };
}
