'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from './auth';
import { ENTITIES, isEntityKey, type EntityKey, type FieldSpec } from './schema';
import { sanitizeHtml } from '@/lib/sanitize';

/**
 * תוצאת פעולה שאינה טופס.
 *
 * קודם לכן מחיקה והחלפת מצב פרסום החזירו void ורק כתבו ליומן, ולכן כשל
 * נראה בדיוק כמו הצלחה: המשתמש לוחץ, שום דבר לא קורה, ואין מה לדווח.
 */
export interface ActionResult {
  error?: string;
}

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

/** רענון העמודים הציבוריים שנוגעים לישות. כשל כאן לא אמור להפיל שמירה. */
function revalidateEntity(entityKey: EntityKey) {
  const entity = ENTITIES[entityKey];
  try {
    for (const path of entity.revalidate) {
      revalidatePath(`/[locale]${path}`, 'page');
    }
    revalidatePath(`/admin/${entityKey}`);
  } catch (error) {
    console.error('[admin:revalidate]', error);
  }
}

/**
 * תיעוד הפעולה ב-audit_log.
 *
 * best-effort במכוון: אם הטבלה חסומה או חסרה, זו אינה סיבה להכשיל שמירה
 * שכבר הצליחה. הכשל נרשם לקונסול כדי שלא ייעלם בשקט.
 */
async function writeAudit(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  action: 'insert' | 'update' | 'delete',
  table: string,
  recordId: string | null,
) {
  const { error } = await supabase
    .from('audit_log')
    .insert({ user_id: userId, action, table_name: table, record_id: recordId });

  if (error) console.error('[admin:audit]', error.code, error.message);
}

/**
 * שמירת רשומה — יצירה כשאין id, עדכון כשיש.
 *
 * ההרשאה נבדקת פעמיים: כאן לפי התפקיד, ושוב במסד עצמו דרך RLS. גם אם
 * מישהו יקרא ל-Server Action ישירות, המדיניות במסד עוצרת אותו.
 *
 * כל גוף הפעולה עטוף ב-try/catch שמחזיר את השגיאה כמצב טופס. בלעדיו כל
 * חריגה בלתי צפויה מפילה את ה-Server Action, והמשתמש רואה מסך שגיאה
 * גנרי של השרת בלי שום רמז מה השתבש.
 */
export async function saveEntity(
  entityKey: string,
  id: string | null,
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  let redirectTo: string | null = null;

  try {
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

      // עמודת not null עם default: השמטה מותירה למסד למלא, שליחת null
      // מפורש נדחית ב-23502. בעדכון המשמעות היא "אל תיגע", וזו ההתנהגות
      // הנכונה — עמודה שאינה מקבלת null ממילא אי אפשר לרוקן.
      if (value === null && spec.omitWhenEmpty) continue;

      payload[spec.name] = value;
    }

    if (typeof payload.slug === 'string' && !SLUG_PATTERN.test(payload.slug)) {
      fieldErrors.slug = 'מזהה כתובת: אותיות לטיניות קטנות, ספרות ומקפים בלבד';
    }

    if (Object.keys(fieldErrors).length > 0) {
      return { status: 'error', message: 'יש שדות שדורשים תיקון', fieldErrors };
    }

    // רק id. הקוד הזה משרת את כל הישויות, ולכן אסור לו לנקוב בעמודה
    // שקיימת רק בחלקן: בקשת slug הפילה כל שמירת באנר ב-42703, כי לבאנרים
    // אין מזהה כתובת. ה-slug גם לא נקרא כאן מעולם.
    const result = id
      ? await supabase.from(entity.table).update(payload).eq('id', id).select('id').maybeSingle()
      : await supabase.from(entity.table).insert(payload).select('id').maybeSingle();

    if (result.error) {
      console.error('[admin:save]', entity.table, result.error.code, result.error.message);
      return { status: 'error', ...describeDbError(result.error, entity) };
    }

    // update שלא פגע באף שורה: RLS סינן אותה, או שה-id אינו קיים.
    if (id && !result.data) {
      return {
        status: 'error',
        message: 'העדכון לא נשמר: הרשומה לא נמצאה או שאין לך הרשאה לערוך אותה.',
      };
    }

    await writeAudit(supabase, session.userId, id ? 'update' : 'insert', entity.table, result.data?.id ?? null);
    revalidateEntity(entityKey as EntityKey);

    if (!id && result.data?.id) redirectTo = `/admin/${entityKey}/${result.data.id}?created=1`;
  } catch (error) {
    console.error('[admin:save] חריגה לא צפויה', error);
    return {
      status: 'error',
      message: `השמירה נכשלה: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // redirect זורק NEXT_REDIRECT ולכן חייב להיות מחוץ ל-try — אחרת ה-catch
  // יבלע אותו וההפניה לא תתרחש.
  if (redirectTo) redirect(redirectTo);

  return { status: 'saved' };
}

/**
 * תרגום שגיאות Postgres נפוצות להודעה שאפשר לפעול לפיה.
 *
 * מקבל את הישות משום ששגיאת כפילות אינה בהכרח על ה-slug: לא לכל ישות יש
 * מזהה כתובת, ותלייה של השגיאה בשדה שאינו קיים בטופס מסתירה אותה לגמרי.
 */
function describeDbError(
  error: { code?: string; message: string },
  entity?: { fields: FieldSpec[] },
): {
  message: string;
  fieldErrors?: Record<string, string>;
} {
  const hasSlug = entity?.fields.some((field) => field.name === 'slug') ?? true;

  switch (error.code) {
    case '23505':
      return hasSlug
        ? { message: 'מזהה הכתובת (slug) כבר קיים', fieldErrors: { slug: 'כבר קיים' } }
        : { message: `ערך כפול: ${error.message}` };
    case '42703':
      return {
        message: `שדה שאינו קיים במסד: ${error.message}. ודאו שכל קובצי ה-SQL הורצו לפי הסדר.`,
      };
    case '23503':
      return { message: 'אחד השדות מפנה לרשומה שאינה קיימת (מחבר או קטגוריה שנמחקו).' };
    case '23514':
      return { message: 'אחד הערכים אינו עומד בכללי המסד. בדקו אורך שדות וערכים מספריים.' };
    case '42501':
      return {
        message:
          'אין הרשאת כתיבה לטבלה. אם הרצתם drop schema public — יש להריץ את supabase/06_restore_grants.sql.',
      };
    case '42P01':
      return { message: 'הטבלה אינה קיימת במסד. ודאו שקובצי הסכימה הורצו במלואם.' };
    default:
      return { message: `השמירה נכשלה: ${error.message}` };
  }
}

export async function deleteEntity(entityKey: string, id: string): Promise<ActionResult> {
  let done = false;

  try {
    if (!isEntityKey(entityKey)) return { error: 'ישות לא מוכרת' };

    const entity = ENTITIES[entityKey as EntityKey];
    const session = await assertRole(entity.writeRole);
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { error } = await supabase.from(entity.table).delete().eq('id', id);
    if (error) {
      console.error('[admin:delete]', error.code, error.message);
      return { error: describeDbError(error, entity).message };
    }

    await writeAudit(supabase, session.userId, 'delete', entity.table, id);
    revalidateEntity(entityKey as EntityKey);
    done = true;
  } catch (error) {
    console.error('[admin:delete] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }

  if (done) redirect(`/admin/${entityKey}`);
  return {};
}

/** החלפת מצב פרסום ישירות מטבלת הרשימה. */
export async function togglePublished(
  entityKey: string,
  id: string,
  next: boolean,
): Promise<ActionResult> {
  try {
    if (!isEntityKey(entityKey)) return { error: 'ישות לא מוכרת' };

    const entity = ENTITIES[entityKey as EntityKey];

    // לא לכל ישות יש מצב פרסום — קטגוריה היא סיווג ולא תוכן. בלי הבדיקה
    // הזו הקריאה הייתה מגיעה למסד ונכשלת ב-42703 על עמודה שאינה קיימת.
    if (!entity.fields.some((field) => field.name === 'is_published')) {
      return { error: 'לישות זו אין מצב פרסום' };
    }

    const session = await assertRole(entity.writeRole);
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { error } = await supabase
      .from(entity.table)
      .update({ is_published: next })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[admin:publish]', error.code, error.message);
      return { error: describeDbError(error, entity).message };
    }

    revalidateEntity(entityKey as EntityKey);
    return {};
  } catch (error) {
    console.error('[admin:publish] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
