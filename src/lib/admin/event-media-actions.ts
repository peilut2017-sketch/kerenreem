'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from './audit';
import { assertScreenPermission } from './auth';
import type { ActionResult } from './actions';

/**
 * [1.11] פעולות ה-CMS של Event Story Gallery — מדיית אירועים ושלבים.
 * ראו supabase/48_event_media.sql. כל פעולה מתועדת ביומן הביקורת
 * ומרעננת את עמוד האירוע הציבורי ואת מסך העריכה.
 */

function revalidateEvent(eventId: string) {
  revalidatePath('/[locale]/events/[slug]', 'page');
  revalidatePath(`/admin/events/${eventId}`);
}

export interface NewMediaItem {
  type: 'image' | 'video';
  url: string;
  thumbnail_url?: string | null;
  width?: number | null;
  height?: number | null;
  video_provider?: 'youtube' | 'vimeo' | 'file' | null;
  video_id?: string | null;
}

/** הוספת פריטי מדיה (אחרי שההעלאה לאחסון כבר הצליחה בצד הלקוח). */
export async function addEventMedia(eventId: string, items: NewMediaItem[]): Promise<ActionResult> {
  const session = await assertScreenPermission('events', 'edit');
  if ('error' in session) return session;
  if (items.length === 0) return {};
  if (items.length > 60) return { error: 'עד 60 פריטים בהעלאה אחת' };

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  // הפריטים החדשים נכנסים בסוף הסדר הקיים
  const { data: last } = await supabase
    .from('event_media')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const base = (last?.sort_order ?? -1) + 1;

  const rows = items
    .filter((item) => typeof item.url === 'string' && item.url.length > 0 && item.url.length <= 800)
    .map((item, index) => ({
      event_id: eventId,
      type: item.type === 'video' ? 'video' : 'image',
      url: item.url,
      thumbnail_url: item.thumbnail_url || null,
      width: item.width ?? null,
      height: item.height ?? null,
      video_provider: item.video_provider ?? null,
      video_id: item.video_id ?? null,
      sort_order: base + index,
    }));

  const { error } = await supabase.from('event_media').insert(rows);
  if (error) return { error: `ההוספה נכשלה: ${error.message}` };

  await writeAuditLog(supabase, session.userId, 'insert', 'event_media', eventId, {
    context: `הוספת ${rows.length} פריטי מדיה לאירוע`,
  });
  revalidateEvent(eventId);
  return {};
}

export interface MediaPatch {
  caption_he?: string | null;
  alt_he?: string | null;
  chapter_id?: string | null;
  is_featured?: boolean;
  is_visible?: boolean;
  focal_x?: number;
  focal_y?: number;
}

export async function updateEventMedia(mediaId: string, patch: MediaPatch): Promise<ActionResult> {
  const session = await assertScreenPermission('events', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const clean: Record<string, unknown> = {};
  if ('caption_he' in patch) clean.caption_he = patch.caption_he?.trim() || null;
  if ('alt_he' in patch) clean.alt_he = patch.alt_he?.trim() || null;
  if ('chapter_id' in patch) clean.chapter_id = patch.chapter_id || null;
  if ('is_featured' in patch) clean.is_featured = Boolean(patch.is_featured);
  if ('is_visible' in patch) clean.is_visible = Boolean(patch.is_visible);
  if ('focal_x' in patch && typeof patch.focal_x === 'number') {
    clean.focal_x = Math.min(1, Math.max(0, patch.focal_x));
  }
  if ('focal_y' in patch && typeof patch.focal_y === 'number') {
    clean.focal_y = Math.min(1, Math.max(0, patch.focal_y));
  }
  if (Object.keys(clean).length === 0) return {};

  const { data, error } = await supabase
    .from('event_media')
    .update(clean)
    .eq('id', mediaId)
    .select('event_id')
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: 'הפריט לא נמצא' };

  await writeAuditLog(supabase, session.userId, 'update', 'event_media', mediaId, {
    newValues: clean,
    context: 'עדכון פריט מדיה באירוע',
  });
  revalidateEvent(data.event_id);
  return {};
}

export async function deleteEventMedia(mediaId: string): Promise<ActionResult> {
  const session = await assertScreenPermission('events', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { data, error } = await supabase
    .from('event_media')
    .delete()
    .eq('id', mediaId)
    .select('event_id, url')
    .maybeSingle();
  if (error) return { error: error.message };

  if (data) {
    await writeAuditLog(supabase, session.userId, 'delete', 'event_media', mediaId, {
      oldValues: { url: data.url },
      context: 'מחיקת פריט מדיה מאירוע',
    });
    revalidateEvent(data.event_id);
  }
  return {};
}

/**
 * שמירת סדר (ושיוך שלבים) לכל הפריטים בפעולה אחת — קריאת RPC יחידה,
 * לא UPDATE נפרד לכל תמונה (ראו reorder_event_media במיגרציה 48).
 */
export async function reorderEventMedia(
  eventId: string,
  items: { id: string; sort_order: number; chapter_id: string | null }[],
): Promise<ActionResult> {
  const session = await assertScreenPermission('events', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase.rpc('reorder_event_media', {
    p_event_id: eventId,
    p_items: items.map((item) => ({
      id: item.id,
      sort_order: item.sort_order,
      chapter_id: item.chapter_id ?? '',
    })),
  });
  if (error) return { error: `שמירת הסדר נכשלה: ${error.message}` };

  await writeAuditLog(supabase, session.userId, 'reorder', 'event_media', eventId, {
    context: `סידור מחדש של ${items.length} פריטי מדיה`,
  });
  revalidateEvent(eventId);
  return {};
}

/** שמירת רשימת השלבים — מחיקה/עדכון/הוספה לפי מה שנשלח. */
export async function saveEventChapters(
  eventId: string,
  chapters: { id: string | null; title_he: string; description_he: string }[],
): Promise<{ error?: string; ids?: string[] }> {
  const session = await assertScreenPermission('events', 'edit');
  if ('error' in session) return { error: session.error };

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const kept = chapters.filter((chapter) => chapter.title_he.trim());
  const keptIds = kept.map((c) => c.id).filter((id): id is string => Boolean(id));

  // שלבים שהוסרו מהרשימה נמחקים; המדיה שלהם חוזרת ל"ללא שלב" (set null)
  const removal = keptIds.length
    ? await supabase.from('event_chapters').delete().eq('event_id', eventId).not('id', 'in', `(${keptIds.join(',')})`)
    : await supabase.from('event_chapters').delete().eq('event_id', eventId);
  if (removal.error) return { error: removal.error.message };

  const ids: string[] = [];
  for (const [index, chapter] of kept.entries()) {
    if (chapter.id) {
      const { error } = await supabase
        .from('event_chapters')
        .update({
          title_he: chapter.title_he.trim(),
          description_he: chapter.description_he.trim() || null,
          sort_order: index,
        })
        .eq('id', chapter.id);
      if (error) return { error: error.message };
      ids.push(chapter.id);
    } else {
      const { data, error } = await supabase
        .from('event_chapters')
        .insert({
          event_id: eventId,
          title_he: chapter.title_he.trim(),
          description_he: chapter.description_he.trim() || null,
          sort_order: index,
        })
        .select('id')
        .maybeSingle();
      if (error) return { error: error.message };
      if (data) ids.push(data.id);
    }
  }

  await writeAuditLog(supabase, session.userId, 'update', 'event_chapters', eventId, {
    context: `עדכון שלבי אירוע — ${kept.length} שלבים`,
  });
  revalidateEvent(eventId);
  return { ids };
}
