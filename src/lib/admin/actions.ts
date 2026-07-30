'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { assertRole } from './auth';
import {
  ENTITIES,
  isEntityKey,
  type EntityKey,
  type EntitySpec,
  type FieldSpec,
  type RelationSpec,
} from './schema';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Author, Category, Series, Tag } from '@/lib/supabase/types';

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
function coerce(spec: FieldSpec, raw: FormDataEntryValue | null, all: FormDataEntryValue[]): unknown {
  if (spec.type === 'boolean') return raw === 'on' || raw === 'true';

  // עמודת מערך: כל הערכים שנבחרו, ולא רק האחרון. FormData.get מחזיר את
  // הראשון בלבד, ולכן בחירה מרובה הייתה נשמרת כערך יחיד.
  if (spec.type === 'text[]') {
    return all.filter((value): value is string => typeof value === 'string' && value !== '');
  }

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
 * מזהה כתובת מתוך שם, עם נפילה לערך אקראי.
 *
 * אותיות עבריות אינן חוקיות ב-slug, ולכן שם עברי בלבד (הרוב המכריע כאן)
 * נופל לחלופה מבוססת זמן ואקראיות. זה מכוער אבל יציב, ועדיף על דחיית
 * היצירה או על slug ריק שיתנגש עם הבא אחריו. הסיומת האקראית מעבר לזמן
 * מונעת התנגשות בין שתי יצירות באותה מילישנייה.
 */
function slugify(name: string, fallbackPrefix: string): string {
  const latin = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return latin || `${fallbackPrefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

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
 * רענון ידני של כל האתר הציבורי.
 *
 * כל העמודים הציבוריים נבנים עם revalidate = 3600 (ISR): התוכן מוגש
 * ממטמון עד שעה, ומתרענן אוטומטית בכל שמירה דרך הטופס. אבל שמירה שלא
 * עברה דרך הטופס — למשל שורה שנוספה ישירות ב-SQL Editor — לא קוראת
 * ל-revalidatePath בכלל, ואז המטמון לא יודע שיש מה לרענן. הפעולה הזו
 * היא הדרך לכפות רענון בלי לחכות לפקיעת השעה ובלי לגעת בקוד.
 *
 * revalidatePath עם type 'layout' על שורש קבוצת השפה מרענן את כל מה
 * שנמצא תחתיו — כל העמודים הציבוריים בבת אחת — ולא רק מסלול בודד.
 */
export async function revalidateAllPublicPages(): Promise<ActionResult> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return session;

    revalidatePath('/[locale]', 'layout');
    for (const entityKey of Object.keys(ENTITIES) as EntityKey[]) {
      revalidateEntity(entityKey);
    }

    return {};
  } catch (error) {
    console.error('[admin:revalidateAll] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
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
 * סנכרון טבלאות הקישור של הישות.
 *
 * מחיקה מלאה ואז הכנסה, ולא חישוב הפרש: הפרש דורש לדעת מה היה בטופס
 * כשנפתח, וטופס שנשאר פתוח בזמן שמישהו אחר ערך את אותו ספר היה מוחק את
 * השינויים שלו בלי להודיע. סנכרון מלא הופך את "מה שרואים בטופס" למה
 * שנשמר, וזו התנהגות שאפשר להסביר.
 *
 * כשל כאן אינו שקט: הספר עצמו כבר נשמר, אבל תגיות שלא נשמרו הן מידע
 * שאבד, והעורך חייב לדעת שעליו לנסות שוב.
 */
async function syncRelations(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  relations: RelationSpec[],
  ownerId: string,
  formData: FormData,
): Promise<string | null> {
  for (const relation of relations) {
    const ids = formData
      .getAll(relation.field)
      .filter((value): value is string => typeof value === 'string' && value !== '');

    const removal = await supabase
      .from(relation.table)
      .delete()
      .eq(relation.ownerColumn, ownerId);

    if (removal.error) {
      console.error('[admin:relations]', relation.table, removal.error.code, removal.error.message);
      return `הרשומה נשמרה, אך עדכון ${relation.table} נכשל: ${removal.error.message}`;
    }

    if (ids.length === 0) continue;

    const insertion = await supabase.from(relation.table).insert(
      // כפילויות בטופס היו מפילות את ההכנסה על מפתח ראשי כפול
      [...new Set(ids)].map((value) => ({
        [relation.ownerColumn]: ownerId,
        [relation.targetColumn]: value,
      })),
    );

    if (insertion.error) {
      console.error('[admin:relations]', relation.table, insertion.error.code, insertion.error.message);
      return `הרשומה נשמרה, אך שמירת ${relation.table} נכשלה: ${insertion.error.message}`;
    }
  }

  return null;
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

    // הטיפוס המפורש נדרש: satisfies מצמצם כל ישות לצורתה המדויקת, ואז
    // relations "אינו קיים" על ישויות שאין להן טבלאות קישור.
    const entity: EntitySpec = ENTITIES[entityKey as EntityKey];
    const session = await assertRole(entity.writeRole);
    if ('error' in session) return { status: 'error', message: session.error };

    const supabase = await createClient();
    if (!supabase) return { status: 'error', message: 'אין חיבור למסד' };

    const payload: Record<string, unknown> = {};
    const fieldErrors: Record<string, string> = {};

    for (const spec of entity.fields) {
      // צ'ק־בוקס שלא סומן אינו נשלח כלל; חייבים לכתוב false במפורש.
      const raw = formData.has(spec.name) ? formData.get(spec.name) : null;
      const value = coerce(spec, raw, formData.getAll(spec.name));

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

    // ספר הוא הישות היחידה שבה מזהה הכתובת אינו חובה (ראו schema.ts): הוספת
    // ספר מהירה לא אמורה להיעצר על "יש להזין מזהה כתובת". נגזר מהכותרת
    // כשאפשר; כותרת עברית — הרוב המכריע כאן — נופלת לערך אקראי, בדיוק
    // כמו יצירת תגית/מחבר/קטגוריה מהירה.
    if (entityKey === 'books' && !payload.slug) {
      payload.slug = slugify(typeof payload.title_he === 'string' ? payload.title_he : '', 'book');
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

    const savedId = result.data?.id ?? id;

    if (savedId && entity.relations) {
      const relationError = await syncRelations(supabase, entity.relations, savedId, formData);
      if (relationError) return { status: 'error', message: relationError };
    }

    await writeAudit(supabase, session.userId, id ? 'update' : 'insert', entity.table, savedId);
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

    // תגית מערכת (חדש, רב מכר) נזרעת בקוד ולוגיקה אחרת עשויה להסתמך על
    // ה-slug שלה — מחיקה מהממשק הייתה יוצרת מצב שאי אפשר לשחזר בלי SQL.
    if (entityKey === 'tags') {
      const { data: tag } = await supabase.from('tags').select('is_system').eq('id', id).maybeSingle();
      if (tag?.is_system) return { error: 'תגית מערכת — אי אפשר למחוק אותה מהממשק.' };
    }

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

/**
 * פעולה אחת על כמה ספרים בבת אחת — מרשימת הניהול, אחרי בחירת שורות.
 *
 * שאילתה יחידה עם .in('id', ids) ולא לולאת קריאות: מאה ספרים נבחרים
 * לא אמורים להיות מאה סבבי רשת. יומן הביקורת כן נכתב פר-ספר, כי הוא
 * מתעד רשומות בודדות ולא קיים לו מקבילה מרוכזת.
 */
export async function bulkUpdateBooks(
  ids: string[],
  action: 'publish' | 'unpublish' | 'delete',
): Promise<ActionResult> {
  if (ids.length === 0) return {};

  try {
    const entity = ENTITIES.books;
    const session = await assertRole(entity.writeRole);
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { error } =
      action === 'delete'
        ? await supabase.from(entity.table).delete().in('id', ids)
        : await supabase
            .from(entity.table)
            .update({ is_published: action === 'publish' })
            .in('id', ids);

    if (error) {
      console.error('[admin:bulk]', entity.table, error.code, error.message);
      return { error: describeDbError(error, entity).message };
    }

    await Promise.all(
      ids.map((id) =>
        writeAudit(supabase, session.userId, action === 'delete' ? 'delete' : 'update', entity.table, id),
      ),
    );

    revalidateEntity('books');
    return {};
  } catch (error) {
    console.error('[admin:bulk] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * יצירת תגית מתוך טופס הספר.
 *
 * ה-slug נגזר מהשם: אותיות עבריות אינן חוקיות ב-slug, ולכן שם עברי בלבד
 * נופל לחלופה מבוססת חותמת זמן. זה מכוער אבל יציב, ועדיף על דחיית היצירה
 * או על slug ריק שיתנגש עם הבא אחריו.
 */
export async function createTag(name: string): Promise<{ tag?: Tag; error?: string }> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return { error: session.error };

    const trimmed = name.trim();
    if (!trimmed) return { error: 'שם התגית ריק' };

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { data, error } = await supabase
      .from('tags')
      .insert({ slug: slugify(trimmed, 'tag'), name_he: trimmed })
      .select('id, slug, name_he, name_en, is_system, description_he')
      .maybeSingle();

    if (error) {
      console.error('[admin:createTag]', error.code, error.message);
      return { error: describeDbError(error).message };
    }

    revalidatePath('/admin/books');
    return { tag: (data as Tag) ?? undefined };
  } catch (error) {
    console.error('[admin:createTag] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * יצירת מחבר או קטגוריה מהירה מתוך טופס הספר.
 *
 * שדה שם בלבד — לא הטופס המלא של מחבר או קטגוריה. הכוונה היא לא לעצור
 * את מילוי הספר כדי ליצור רשומת שיוך שעוד לא קיימת; שאר הפרטים (ביוגרפיה,
 * תמונה וכו') ממלאים אחר כך במסך הייעודי, אם בכלל.
 *
 * מחבר חדש נוצר כמפורסם במפורש: הוא נוצר כדי להיות משויך לספר שעומד
 * להתפרסם, ומחבר טיוטה היה גורם לעמוד המחבר עצמו להחזיר "לא נמצא" בזמן
 * שהספר שלו כבר חי באתר.
 */
export async function createAuthorQuick(name: string): Promise<{ author?: Author; error?: string }> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return { error: session.error };

    const trimmed = name.trim();
    if (!trimmed) return { error: 'שם המחבר ריק' };

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { data, error } = await supabase
      .from('authors')
      .insert({ slug: slugify(trimmed, 'author'), name_he: trimmed, is_published: true })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin:createAuthorQuick]', error.code, error.message);
      return { error: describeDbError(error, ENTITIES.authors).message };
    }

    revalidatePath('/admin/books');
    revalidatePath('/admin/authors');
    return { author: (data as Author) ?? undefined };
  } catch (error) {
    console.error('[admin:createAuthorQuick] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createCategoryQuick(name: string): Promise<{ category?: Category; error?: string }> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return { error: session.error };

    const trimmed = name.trim();
    if (!trimmed) return { error: 'שם הקטגוריה ריק' };

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { data, error } = await supabase
      .from('categories')
      .insert({ slug: slugify(trimmed, 'category'), name_he: trimmed })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin:createCategoryQuick]', error.code, error.message);
      return { error: describeDbError(error, ENTITIES.categories).message };
    }

    revalidatePath('/admin/books');
    revalidatePath('/admin/categories');
    return { category: (data as Category) ?? undefined };
  } catch (error) {
    console.error('[admin:createCategoryQuick] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function createSeriesQuick(name: string): Promise<{ series?: Series; error?: string }> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return { error: session.error };

    const trimmed = name.trim();
    if (!trimmed) return { error: 'שם הסדרה ריק' };

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const { data, error } = await supabase
      .from('series')
      .insert({ slug: slugify(trimmed, 'series'), name_he: trimmed })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[admin:createSeriesQuick]', error.code, error.message);
      return { error: describeDbError(error, ENTITIES.series).message };
    }

    revalidatePath('/admin/books');
    revalidatePath('/admin/series');
    return { series: (data as Series) ?? undefined };
  } catch (error) {
    console.error('[admin:createSeriesQuick] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * שמירת גלריית התמונות או תוכן העניינים של ספר — מחיקה מלאה והכנסה
 * מחדש, כמו syncRelations בשמירת הספר עצמו ומאותה סיבה: הפרש בין הישן
 * לחדש דורש לדעת מה היה כשהטופס נפתח, וזה שביר כשיש שתי לשוניות פתוחות.
 * שתי הטבלאות שייכות לספר אחד ולא לכל הקטלוג, ולכן אין כאן סיכון של
 * "מחיקת הכול בטעות" כמו שהיה בטבלת קישור משותפת.
 */
export async function saveBookImages(
  bookId: string,
  images: { image_url: string; alt: string; caption_he: string }[],
): Promise<ActionResult> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const removal = await supabase.from('book_images').delete().eq('book_id', bookId);
    if (removal.error) {
      console.error('[admin:saveBookImages]', removal.error.code, removal.error.message);
      return { error: describeDbError(removal.error).message };
    }

    const rows = images
      .filter((image) => image.image_url)
      .map((image, index) => ({
        book_id: bookId,
        image_url: image.image_url,
        alt: image.alt || null,
        caption_he: image.caption_he || null,
        sort_order: index,
      }));

    if (rows.length > 0) {
      const insertion = await supabase.from('book_images').insert(rows);
      if (insertion.error) {
        console.error('[admin:saveBookImages]', insertion.error.code, insertion.error.message);
        return { error: describeDbError(insertion.error).message };
      }
    }

    revalidatePath(`/[locale]/books/[slug]`, 'page');
    revalidatePath(`/admin/books/${bookId}`);
    return {};
  } catch (error) {
    console.error('[admin:saveBookImages] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveBookToc(
  bookId: string,
  entries: { title_he: string; level: number; page_number: number | null; summary_he: string }[],
): Promise<ActionResult> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const removal = await supabase.from('book_toc').delete().eq('book_id', bookId);
    if (removal.error) {
      console.error('[admin:saveBookToc]', removal.error.code, removal.error.message);
      return { error: describeDbError(removal.error).message };
    }

    const rows = entries
      .filter((entry) => entry.title_he.trim())
      .map((entry, index) => ({
        book_id: bookId,
        title_he: entry.title_he.trim(),
        level: entry.level,
        page_number: entry.page_number,
        summary_he: entry.summary_he || null,
        sort_order: index,
      }));

    if (rows.length > 0) {
      const insertion = await supabase.from('book_toc').insert(rows);
      if (insertion.error) {
        console.error('[admin:saveBookToc]', insertion.error.code, insertion.error.message);
        return { error: describeDbError(insertion.error).message };
      }
    }

    revalidatePath(`/[locale]/books/[slug]`, 'page');
    revalidatePath(`/admin/books/${bookId}`);
    return {};
  } catch (error) {
    console.error('[admin:saveBookToc] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * רצף בלוקי הסיפור של אירוע — מוחלף במלואו, לא מחושב כהפרש.
 * אותו נימוק כמו syncRelations/saveBookToc: הפרש דורש לדעת מה היה קודם,
 * וטופס שנשאר פתוח בזמן שמישהו אחר ערך היה מוחק בשקט את השינויים שלו.
 */
export async function saveEventBlocks(
  eventId: string,
  blocks: {
    type: string;
    stage_label: string;
    body_he: string;
    image_url: string;
    image_alt: string;
    image_caption_he: string;
    images: { url: string; alt: string; caption_he: string }[];
    video_url: string;
    video_caption_he: string;
    quote_text: string;
    quote_attribution_he: string;
  }[],
): Promise<ActionResult> {
  try {
    const session = await assertRole('editor');
    if ('error' in session) return session;

    const supabase = await createClient();
    if (!supabase) return { error: 'אין חיבור למסד' };

    const removal = await supabase.from('event_blocks').delete().eq('event_id', eventId);
    if (removal.error) {
      console.error('[admin:saveEventBlocks]', removal.error.code, removal.error.message);
      return { error: describeDbError(removal.error).message };
    }

    const rows = blocks.map((block, index) => ({
      event_id: eventId,
      type: block.type,
      sort_order: index,
      stage_label: block.stage_label.trim() || null,
      body_he: block.body_he || null,
      image_url: block.image_url || null,
      image_alt: block.image_alt || null,
      image_caption_he: block.image_caption_he || null,
      images: block.images,
      video_url: block.video_url || null,
      video_caption_he: block.video_caption_he || null,
      quote_text: block.quote_text || null,
      quote_attribution_he: block.quote_attribution_he || null,
    }));

    if (rows.length > 0) {
      const insertion = await supabase.from('event_blocks').insert(rows);
      if (insertion.error) {
        console.error('[admin:saveEventBlocks]', insertion.error.code, insertion.error.message);
        return { error: describeDbError(insertion.error).message };
      }
    }

    revalidatePath(`/[locale]/events/[slug]`, 'page');
    revalidatePath(`/admin/events/${eventId}`);
    return {};
  } catch (error) {
    console.error('[admin:saveEventBlocks] חריגה לא צפויה', error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
