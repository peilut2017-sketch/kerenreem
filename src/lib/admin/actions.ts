'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from './auth';
import { ENTITIES, isEntityKey, type EntityKey, type FieldSpec } from './schema';
import { sanitizeHtml } from '@/lib/sanitize';

export interface SaveState {
  status: 'idle' | 'saved' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** המרת ערך מהטופס לטיפוס העמודה. מחרוזת ריקה נשמרת כ-null ולא כ-"". */
function coerce(spec: FieldSpec, raw: FormDataEntryValue | null): unknown {
  if (spec.type === 'boolean') return raw === 'on' || raw === 'true';

  const value = typeof raw === 'string' ? raw.trim() : '';
  if (value === '') return null;

  switch (spec.type) {
    case 'number': {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    case 'html':
      // ניקוי בשרת ולא רק בתצוגה: HTML זדוני לא ייכנס למסד מלכתחילה.
      return sanitizeHtml(value);
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    default:
      return value;
  }
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * שמירת רשומה — יצירה כשאין id, עדכון כשיש.
 *
 * ההרשאה נבדקת פעמיים: כאן לפי התפקיד, ושוב במסד עצמו דרך RLS. גם אם
 * מישהו יקרא ל-Server Action ישירות, המדיניות במסד עוצרת אותו.
 */
export async function saveEntity(
  entityKey: string,
  id: string | null,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  if (!isEntityKey(entityKey)) return { status: 'error', message: 'ישות לא מוכרת' };

  const entity = ENTITIES[entityKey as EntityKey];
  const session = await assertRole(entity.writeRole);
  if ('error' in session) return { status: 'error', message: session.error };

  const supabase = await createClient();
  if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

  const payload: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};

  for (const spec of entity.fields) {
    // צ'ק־בוקס שלא סומן אינו נשלח כלל; חייבים לכתוב false במפורש.
    const raw = formData.has(spec.name) ? formData.get(spec.name) : null;
    const value = coerce(spec, raw);

    if (spec.required && (value === null || value === '')) {
      fieldErrors[spec.name] = 'שדה חובה';
      continue;
    }
    payload[spec.name] = value;
  }

  if (typeof payload.slug === 'string' && !SLUG_PATTERN.test(payload.slug)) {
    fieldErrors.slug = 'מזהה כתובת: אותיות לטיניות קטנות, ספרות ומקפים בלבד';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { status: 'error', message: 'יש שדות שדורשים תיקון', fieldErrors };
  }

  const result = id
    ? await supabase.from(entity.table).update(payload).eq('id', id).select('id, slug').maybeSingle()
    : await supabase.from(entity.table).insert(payload).select('id, slug').maybeSingle();

  if (result.error) {
    const duplicate = result.error.code === '23505';
    return {
      status: 'error',
      message: duplicate ? 'מזהה הכתובת (slug) כבר קיים' : `השמירה נכשלה: ${result.error.message}`,
      fieldErrors: duplicate ? { slug: 'כבר קיים' } : undefined,
    };
  }

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: id ? 'update' : 'insert',
    table_name: entity.table,
    record_id: result.data?.id ?? null,
  });

  for (const path of entity.revalidate(payload)) {
    revalidatePath(`/[locale]${path === '/' ? '' : path}`, 'page');
  }
  revalidatePath(`/admin/${entityKey}`);

  if (!id && result.data?.id) {
    redirect(`/admin/${entityKey}/${result.data.id}?created=1`);
  }

  return { status: 'saved' };
}

export async function deleteEntity(entityKey: string, id: string): Promise<void> {
  if (!isEntityKey(entityKey)) return;

  const entity = ENTITIES[entityKey as EntityKey];
  const session = await assertRole(entity.writeRole);
  if ('error' in session) return;

  const supabase = await createClient();
  if (!supabase) return;

  const { error } = await supabase.from(entity.table).delete().eq('id', id);
  if (error) {
    console.error('[admin:delete]', error);
    return;
  }

  await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'delete',
    table_name: entity.table,
    record_id: id,
  });

  revalidatePath(`/admin/${entityKey}`);
  redirect(`/admin/${entityKey}`);
}

/** החלפת מצב פרסום ישירות מטבלת הרשימה. */
export async function togglePublished(
  entityKey: string,
  id: string,
  next: boolean,
): Promise<void> {
  if (!isEntityKey(entityKey)) return;

  const entity = ENTITIES[entityKey as EntityKey];
  const session = await assertRole(entity.writeRole);
  if ('error' in session) return;

  const supabase = await createClient();
  if (!supabase) return;

  const { data, error } = await supabase
    .from(entity.table)
    .update({ is_published: next })
    .eq('id', id)
    .select('slug')
    .maybeSingle();

  if (error) {
    console.error('[admin:publish]', error);
    return;
  }

  for (const path of entity.revalidate(data ?? {})) {
    revalidatePath(`/[locale]${path === '/' ? '' : path}`, 'page');
  }
  revalidatePath(`/admin/${entityKey}`);
}
