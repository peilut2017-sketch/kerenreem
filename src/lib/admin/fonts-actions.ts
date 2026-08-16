'use server';

import { revalidatePath } from 'next/cache';
import { isProjectStorageUrl } from '@/lib/image-src';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from './audit';
import { assertRole } from './auth';
import type { ActionResult } from './actions';

/**
 * [1.11] ניהול גופנים מותקנים (custom_fonts) — התקנה, הפעלה/כיבוי
 * ומחיקה. קובץ הגופן כבר הועלה ל-bucket הציבורי 'site' בצד הלקוח
 * (FontsManager); כאן נרשמת השורה שמזריקה אותו לאתר ולעורכים.
 * ברמת manager, כמו שאר הגדרות האתר.
 */

/** slug לטיני למשתנה ה-CSS. שם עברי מקבל מזהה אקראי — המשתנה טכני ממילא. */
function fontSlug(name: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const random = Math.random().toString(36).slice(2, 8);
  return latin ? `${latin}-${random}` : `font-${random}`;
}

export async function createCustomFont(name: string, fontUrl: string): Promise<ActionResult> {
  const session = await assertRole('manager');
  if ('error' in session) return session;

  const trimmed = name.trim();
  if (!trimmed) return { error: 'יש להזין שם לגופן' };
  if (trimmed.length > 60) return { error: 'שם הגופן ארוך מדי' };
  if (!isProjectStorageUrl(fontUrl) || /['"\\)]/.test(fontUrl)) {
    return { error: 'קובץ הגופן חייב להיות מאחסון האתר' };
  }
  if (!/\.(woff2?|ttf|otf)$/i.test(fontUrl)) {
    return { error: 'סוג הקובץ אינו נתמך — woff2, woff, ttf או otf' };
  }

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { data, error } = await supabase
    .from('custom_fonts')
    .insert({ name: trimmed, slug: fontSlug(trimmed), font_url: fontUrl })
    .select('id')
    .maybeSingle();
  if (error) return { error: `ההתקנה נכשלה: ${error.message}` };

  await writeAuditLog(supabase, session.userId, 'insert', 'custom_fonts', data?.id ?? null, {
    newValues: { name: trimmed, font_url: fontUrl },
    context: `התקנת גופן: ${trimmed}`,
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return {};
}

export async function toggleCustomFont(id: string, active: boolean): Promise<ActionResult> {
  const session = await assertRole('manager');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase.from('custom_fonts').update({ is_active: active }).eq('id', id);
  if (error) return { error: error.message };

  await writeAuditLog(supabase, session.userId, 'update', 'custom_fonts', id, {
    newValues: { is_active: active },
    context: active ? 'הפעלת גופן' : 'כיבוי גופן',
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return {};
}

export async function deleteCustomFont(id: string): Promise<ActionResult> {
  const session = await assertRole('manager');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { data: doomed } = await supabase.from('custom_fonts').select('name').eq('id', id).maybeSingle();
  const { error } = await supabase.from('custom_fonts').delete().eq('id', id);
  if (error) return { error: error.message };

  await writeAuditLog(supabase, session.userId, 'delete', 'custom_fonts', id, {
    oldValues: (doomed as Record<string, unknown> | null) ?? null,
    context: doomed ? `הסרת גופן: ${doomed.name}` : 'הסרת גופן',
  });
  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  return {};
}
