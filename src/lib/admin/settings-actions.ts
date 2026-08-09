'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertRole, assertScreenPermission } from './auth';
import type { ActionResult } from './actions';
import type { UserRole } from '@/lib/supabase/types';

export interface SettingsState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? '').trim();

/**
 * שמירת הגדרות האתר. שורה יחידה (id=1), ולכן זו תמיד פעולת update.
 * [1.7] הורד מ-admin ל-manager: זהות ארגון היא הגדרה, לא ניהול משתמשים —
 * "מנהל ראשי" מוגדר כ"גישה לכל ההגדרות, לא כולל הוספת משתמשים" (screens.ts,
 * org-settings אינו ב-ADMIN_ONLY_SCREENS).
 */
export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await assertRole('manager');
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
    // store_enabled אינו כאן בכוונה: הוא עבר לעמוד "הגדרות קטלוג וחנות"
    // תחת ספרים (ראו saveStoreSettings למטה), ונשמר בפעולה נפרדת משלו.
    // טופס זה אינו שולח את השדה כלל, ואילו הרשומה כאן הייתה כוללת אותו
    // עם false כברירת מחדל, כל שמירה של הפרטים הכלליים הייתה מכבה את
    // החנות בלי שהמנהל התכוון לכך.
    .update({
      logo_url: text(formData, 'logo_url') || null,
      logo_dark_url: text(formData, 'logo_dark_url') || null,
      contact,
      social_links,
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

/**
 * הגדרות הקטלוג/חנות — טופס נפרד מהגדרות האתר הכלליות, ועם פעולת שמירה
 * נפרדת משלו: עדכון עמודה יחידה (store_enabled) ותו לא. אילו הטופס הזה
 * היה משתמש ב-saveSettings הרגילה, שמירתו הייתה שולחת FormData שחסרים
 * בו כל שדות הקשר/רשתות/לוגו — ו-saveSettings הייתה קוראת אותם כריקים
 * ומוחקת אותם בפועל. שתי הגדרות בשני טפסים נפרדים דורשות שתי פעולות
 * נפרדות, לא אחת גנרית.
 */
export interface StoreSettingsState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
}

export async function saveStoreSettings(
  _prev: StoreSettingsState,
  formData: FormData,
): Promise<StoreSettingsState> {
  // [1.7] הורד מ-admin ל-manager — ראו הערה ב-saveSettings למעלה.
  const session = await assertRole('manager');
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const { error } = await supabase
    .from('site_settings')
    .update({
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

  // דגל החנות קובע אם כפתורי רכישה ומחירים מוצגים בעמודי הספרים.
  revalidatePath('/[locale]/books/[slug]', 'page');
  revalidatePath('/admin/books/settings');

  return { status: 'saved' };
}

/**
 * דגלים קטנים שחיים בתוך site_settings.extra (jsonb) ולא בעמודה ייעודית
 * — כדי לא לדרוש מיגרציה לכל הגדרה נקודתית חדשה. שתי הפעולות למטה
 * (הפעלת באנרים, ספרי המדף) קוראות את extra הקיים וממזגות לתוכו רק את
 * המפתח שלהן, כי שתיהן חולקות את אותה עמודה ונשמרות משני עמודי ניהול
 * נפרדים — כתיבה גורפת הייתה מוחקת בשקט את המפתח שהעמוד השני שמר.
 */
async function mergeExtra(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  patch: Record<string, unknown>,
): Promise<{ error: string } | null> {
  const { data: current } = await supabase.from('site_settings').select('extra').eq('id', 1).maybeSingle();
  const extra = { ...((current?.extra as Record<string, unknown> | null) ?? {}), ...patch };

  const { error } = await supabase
    .from('site_settings')
    .update({ extra, updated_at: new Date().toISOString() })
    .eq('id', 1);

  return error ? { error: `השמירה נכשלה: ${error.message}` } : null;
}

/**
 * הפעלה/כיבוי מלא של קרוסלת הבאנרים בעמוד הבית — נפרד ממצב הפרסום של
 * כל באנר בודד. כשכבויה, העמוד נופל לגיבוי הרגיל (קרוסלה שנבנית מתוכן
 * שפורסם, או הצהרה טיפוגרפית) גם אם יש באנרים מפורסמים.
 */
export async function saveBannersEnabled(enabled: boolean): Promise<ActionResult> {
  // [1.7] הורד מ-admin ל-manager — ראו הערה ב-saveSettings למעלה.
  const session = await assertRole('manager');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const mergeError = await mergeExtra(supabase, { banners_enabled: enabled });
  if (mergeError) return mergeError;

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'site_settings',
    record_id: null,
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/banners');
  return {};
}

/**
 * רשימת הספרים המוצגים במדף בעמוד הבית, בסדר התצוגה שנבחר בגרירה
 * (ראו ShelfBooksPicker.tsx). רשימה ריקה = נפילה חזרה לברירת המחדל
 * (הכותרים האחרונים, ראו getBooksByIds/getRecentBooks ב-data.ts).
 */
export async function saveShelfBooks(bookIds: string[]): Promise<ActionResult> {
  // [1.7] editor → הרשאה גרגרית על מסך homepage-shelf עצמו.
  const session = await assertScreenPermission('homepage-shelf', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const mergeError = await mergeExtra(supabase, { shelf_book_ids: bookIds });
  if (mergeError) return mergeError;

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'update',
    table_name: 'site_settings',
    record_id: null,
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/books/homepage-shelf');
  return {};
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
