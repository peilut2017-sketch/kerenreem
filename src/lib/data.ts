import 'server-only';
import { cache } from 'react';
import { createStaticClient } from './supabase/server';
import { demo, isDemoContent } from './demo-content';
import { filterVisibleAttributes } from './attributes';
import type {
  Activity,
  Attribute,
  AttributeValue,
  AttributeWithValues,
  Banner,
  Author,
  Book,
  BookRelation,
  BookWithRelations,
  Category,
  ContactField,
  ContactTopic,
  ContentPage,
  CustomFont,
  EventBlock,
  EventChapter,
  EventMediaItem,
  EventRecord,
  SiteSettings,
  Tag,
} from './supabase/types';

/**
 * שכבת קריאה לתוכן הציבורי.
 *
 * כל פונקציה מחזירה ערך ריק (מערך ריק / null) כשהמסד אינו מוגדר או
 * כששליפה נכשלת. העמודים מציגים מצב ריק במקום ליפול — אתר תוכן לא צריך
 * להיעלם בגלל תקלת רשת רגעית.
 */

/**
 * שתי צורות לשליפת ספר.
 *
 * BOOK_SELECT מצרף גם תגיות ומאפיינים — שליפה אחת במקום שלושה סבבי רשת.
 * אבל הטבלאות האלה נוספו ב-08_pim_stage_a.sql, ובמסד שבו הקובץ טרם הורץ
 * ההצטרפות נכשלת ומחזירה שגיאה — כלומר **אפס ספרים בכל האתר**.
 *
 * זו הייתה תקלה אמיתית: הקטלוג התרוקן לגמרי רק משום שקובץ SQL לא הורץ.
 * טבלה אופציונלית לא אמורה להפיל את התוכן המרכזי, ולכן יש נפילה אחורה
 * לשליפה הבסיסית.
 */
/**
 * category:categories!books_category_id_fkey — לא category:categories סתם.
 *
 * מאז שנוספה book_categories (הקטגוריות הנוספות, 08_pim_stage_a.sql) יש
 * שני מסלולי קשר בין books ל-categories: העמודה הישירה category_id, וגם
 * המסלול דרך book_categories. PostgREST מזהה את שניהם כ"קשר בין books
 * ל-categories" ולא יכול לנחש איזה מהם מתכוונים אליו ב-category:categories
 * הרגיל — הוא נכשל עם PGRST201 ("more than one relationship was found").
 *
 * זו הייתה הסיבה שהקטלוג הציג אפס ספרים אחרי הרצת 08_pim_stage_a.sql:
 * getBooks() בולעת שגיאות שאינן "טבלה חסרה" ומחזירה מערך ריק בשקט, כך
 * שה-PGRST201 הזה מעולם לא הגיע ליומן שמישהו רואה. שם האילוץ המפורש
 * מכריח את PostgREST להשתמש בעמודה הישירה, ומסיר את העמימות.
 */
const BOOK_BASE_SELECT = `
  *,
  author:authors ( id, slug, name_he, name_en ),
  category:categories!books_category_id_fkey ( id, slug, name_he, name_en )
`;

/**
 * tags:tags(... בלי description_he.
 *
 * זו בדיוק התקלה שכבר קרתה כאן עם category: הוספת עמודה חדשה (שלב ג׳,
 * 10_book_page_stage_c.sql) לתוך ה-select ה*משותף* ששולפים בו כרטיסי
 * ספרים, רשימת הבית ועמוד המחבר — לא רק עמוד הספר הבודד. אם המיגרציה
 * טרם רצה במסד, "description_he" אינה עמודה קיימת, והשגיאה מפילה את
 * כל השליפה — כלומר את כל הקטלוג, לא רק את עמוד הספר. description_he
 * נשלף רק ב-BOOK_DETAIL_SELECT למטה, ששם יש שכבת נפילה נוספת בשבילו.
 */
/**
 * [1.21] categories:book_categories — לא category:categories!books_category_id_fkey
 * שנייה. אותו bucket, כל הקטגוריות (כולל הראשית — הטופס בניהול שומר את כל
 * הבחירה המרובה ל-book_categories דרך syncRelations הגנרי ב-actions.ts,
 * וגוזר משם גם את category_id הסקלרי, ראו saveEntity), כך שהתצוגה
 * הציבורית לא צריכה למזג שני מקורות בעצמה.
 */
const BOOK_SELECT = `
  ${BOOK_BASE_SELECT},
  categories:book_categories ( category:categories ( id, slug, name_he, name_en ) ),
  tags:book_tags ( tag:tags ( id, slug, name_he, name_en ) ),
  attributeValues:book_attributes ( value:attribute_values ( id, slug, name_he, attribute_id ) )
`;

/**
 * [1.6] שכבה נוספת מעל BOOK_SELECT: הסדרה, למסנן סדרה בקטלוג (ח.17) —
 * לפני כן series נשלף רק ב-BOOK_DETAIL_SELECT (עמוד ספר בודד), כך
 * שרשימת הקטלוג לא יכלה לסנן/להציג לפיו כלל. אותו נימוק כמו שאר שכבות
 * ה-fallback כאן: books_series_id_fkey כבר קיים ב-10_book_page_stage_c.sql,
 * אבל שכבה נפרדת (ולא תוספת ל-BOOK_SELECT עצמו) שומרת נפילה חלקה למסד
 * שטרם הריץ את המיגרציה הזאת.
 */
const BOOK_SELECT_WITH_SERIES = `
  ${BOOK_SELECT},
  series:series!books_series_id_fkey ( id, slug, name_he, name_en )
`;

/**
 * שליפה מלאה, רק לעמוד הספר הבודד: מוסיפה סדרה, גלריה, תוכן עניינים
 * והסבר לתגית — שדות ששלב ג׳ (10_book_page_stage_c.sql) הוסיף, ושרשימות
 * וכרטיסים לא צריכים (join מיותר בכל טעינת קטלוג של מאות ספרים).
 *
 * לא בנויה מעל BOOK_SELECT: מגדירה מחדש את tags עם description_he,
 * ולכן אינה משתפת את הביטוי של BOOK_SELECT.
 *
 * series:series!books_series_id_fkey ולא series:series סתם, מאותה סיבה
 * בדיוק שהוסברה למעלה על category: מסלול קשר אחד היום, אבל אילוץ מפורש
 * הוא הבטוח כשמישהו יוסיף בעתיד טבלת קישור נוספת לסדרות.
 */
const BOOK_DETAIL_SELECT = `
  ${BOOK_BASE_SELECT},
  tags:book_tags ( tag:tags ( id, slug, name_he, name_en, description_he ) ),
  attributeValues:book_attributes ( value:attribute_values ( id, slug, name_he, attribute_id ) ),
  series:series!books_series_id_fkey ( id, slug, name_he, name_en ),
  images:book_images ( id, book_id, image_url, alt, caption_he, sort_order ),
  toc:book_toc ( id, book_id, title_he, level, page_number, summary_he, sort_order )
`;

/**
 * שכבה נוספת מעל BOOK_DETAIL_SELECT: קשרים ידניים בין ספרים
 * (book_relations, 14_book_page_v3.sql). שכבה נפרדת ולא מוצמדת ל-select
 * הקודם — בדיוק אותו נימוק כמו BOOK_DETAIL_SELECT מול BOOK_SELECT: מסד
 * שטרם הריץ את המיגרציה הזאת עדיין מקבל את שאר עמוד הספר במלואו, ורק
 * גוש הקשרים הידניים נעדר.
 */
const BOOK_DETAIL_SELECT_V3 = `
  ${BOOK_DETAIL_SELECT},
  relations:book_relations!book_relations_source_book_id_fkey (
    id, relation_type, sort_order, note_he, note_en,
    target:books!book_relations_target_book_id_fkey (
      id, slug, title_he, title_en, cover_image_url, price, currency, is_purchasable, stock_quantity,
      author:authors ( id, slug, name_he, name_en )
    )
  )
`;

/**
 * שכבה נוספת מעל BOOK_DETAIL_SELECT_V3: דפי דוגמה שעברו המרה
 * (book_preview_pages, 15_book_flip_preview.sql). hero_mockup_url עצמו
 * אינו זקוק לשכבה נפרדת — הוא עמודה על books ונשלף כבר דרך ה-`*` הקיים
 * ב-BOOK_BASE_SELECT, בדיוק כמו שאר עמודות הסקאלר שנוספו בשלב ד׳.
 */
const BOOK_DETAIL_SELECT_V4 = `
  ${BOOK_DETAIL_SELECT_V3},
  previewPages:book_preview_pages ( id, book_id, page_number, image_url, width, height, created_at )
`;

const MISSING_SCHEMA_CODES = new Set(['42P01', '42703', 'PGRST200']);

/**
 * מנסה שכבת select עשירה, ונופל לשכבה בסיסית יותר כשהיא אינה אפשרית.
 * 42P01 = הטבלה אינה קיימת, 42703 = העמודה אינה קיימת (טבלה קיימת אבל
 * מיגרציה שהוסיפה לה עמודה טרם רצה), PGRST200 = הקשר אינו מוכר ל-PostgREST.
 *
 * שלושתם "אותה משפחה": שכבת סכימה שהקוד מצפה לה טרם הורצה במסד. הבדיקה
 * לפי קוד השגיאה ולא לפי הודעת טקסט, כי ההודעה משתנה בין גרסאות PostgREST
 * והקוד לא. משותף לספרים ולאירועים — שניהם נתקלו באותה בעיה בדיוק
 * (עמודה/טבלה של שלב חדש שנוספה ל-select משותף לפני שהמיגרציה רצה).
 *
 * הניסיון המלא נעשה מחדש בכל קריאה, בלי "לזכור" כשל קודם. גרסה מוקדמת
 * שמרה דגל ברמת המודול כדי לחסוך ניסיון חוזר — אבל מודול בשרת נטען פעם
 * אחת לתהליך, ותהליך חם ממשיך לשרת בקשות רבות. אם הבקשה הראשונה על
 * תהליך נתון נתקלה בטבלה חסרה, הדגל ננעל על true לצמיתות עבור אותו
 * תהליך, גם אחרי שהטבלאות נוצרו. עלות הניסיון החוזר זניחה.
 */
async function withSchemaFallback(
  build: (select: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  scope: string,
  selects: readonly string[],
): Promise<unknown> {
  for (let i = 0; i < selects.length; i += 1) {
    const result = await build(selects[i]);
    if (!result.error) return result.data;

    const isMissingLayer = MISSING_SCHEMA_CODES.has(result.error.code ?? '');
    const isLast = i === selects.length - 1;

    if (!isMissingLayer || isLast) {
      warn(scope, result.error);
      return null;
    }

    console.warn(
      `[data:${scope}] שכבת נתונים חסרה (שלב ${i + 1} מתוך ${selects.length}) — ` +
        'יש להריץ את קובצי ה-SQL של מכון קרן רא״ם לפי הסדר. נופל לשכבה הבסיסית יותר.',
    );
  }

  return null;
}

async function runBookQuery<T>(
  build: (select: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  scope: string,
  selects: readonly string[] = [BOOK_SELECT, BOOK_BASE_SELECT],
): Promise<T[]> {
  const data = await withSchemaFallback(build, scope, selects);
  return data ? (shapeBooks(data) as T[]) : [];
}

/**
 * PostgREST מחזיר טבלת קישור כמערך של עוטפים ({ tag: {...} }).
 * השטחה כאן, פעם אחת, כדי שכל הצרכנים יקבלו מערך פשוט.
 */
type Wrapped<K extends string, T> = Record<K, T | null>[];

function flatten<K extends string, T>(rows: unknown, key: K): T[] {
  if (!Array.isArray(rows)) return [];
  return (rows as Wrapped<K, T>)
    .map((row) => row[key])
    .filter((value): value is T => value !== null && value !== undefined);
}

/** ממיין לפי sort_order רק כשהמערך בכלל נשלף (BOOK_DETAIL_SELECT). */
function bySortOrder<T extends { sort_order: number }>(rows: T[] | undefined): T[] | undefined {
  return rows ? [...rows].sort((a, b) => a.sort_order - b.sort_order) : undefined;
}

/** ממיין דפי דוגמה לפי מספר העמוד — אין להם sort_order נפרד, המספר עצמו הוא הסדר. */
function byPageNumber<T extends { page_number: number }>(rows: T[] | undefined): T[] | undefined {
  return rows ? [...rows].sort((a, b) => a.page_number - b.page_number) : undefined;
}

function shapeBook(row: unknown): BookWithRelations {
  const book = row as BookWithRelations & { tags?: unknown; categories?: unknown; attributeValues?: unknown };
  const categories = flatten<'category', NonNullable<BookWithRelations['category']>>(book.categories, 'category');
  return {
    ...book,
    // [1.21] כשהשליפה ביקשה categories (BOOK_SELECT ומעלה) אבל לספר אין
    // אף שורת book_categories, flatten מחזירה [] — לא undefined — ולכן
    // מפילים חזרה לקטגוריה הראשית הבודדת כדי שספרים ישנים/שטרם עברו
    // גיבוי (ראו 51_book_categories_backfill.sql) עדיין יציגו קטגוריה.
    categories: categories.length ? categories : book.category ? [book.category] : [],
    tags: flatten(book.tags, 'tag'),
    attributeValues: flatten(book.attributeValues, 'value'),
    images: bySortOrder(book.images),
    toc: bySortOrder(book.toc),
    relations: bySortOrder(book.relations as BookRelation[] | undefined),
    previewPages: byPageNumber(book.previewPages),
    // quotes ו-view_count הן עמודות ששלב ג׳ הוסיף (10_book_page_stage_c.sql).
    // אם המיגרציה טרם רצה הן פשוט חסרות בשורה שחוזרת מהמסד — undefined
    // ולא []/0 — וכל קוד שקורא book.quotes.length קורס עם TypeError.
    quotes: book.quotes ?? [],
    view_count: book.view_count ?? 0,
  };
}

function shapeBooks(rows: unknown): BookWithRelations[] {
  return Array.isArray(rows) ? rows.map(shapeBook) : [];
}

function warn(scope: string, error: unknown) {
  if (error) console.error(`[data:${scope}]`, error);
}

/* -------------------------------------------------------------------------- */
/* ספרים                                                                       */
/* -------------------------------------------------------------------------- */

export async function getBooks(): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.books() : [];

  return runBookQuery<BookWithRelations>(
    (select) =>
      supabase.from('books').select(select).eq('is_published', true).order('title_he', { ascending: true }),
    'getBooks',
    [BOOK_SELECT_WITH_SERIES, BOOK_SELECT, BOOK_BASE_SELECT],
  );
}

/**
 * עטוף ב-cache() כמו getSiteSettings: נקרא פעמיים בכל רינדור עמוד ספר —
 * generateMetadata וגוף העמוד — ו-Next עושה דה-דופליקציה רק ל-fetch,
 * לא לפונקציות אסינכרוניות. בלי העטיפה, השליפה הרחבה ביותר בקוד
 * (BOOK_DETAIL_SELECT_V4) רצה פעמיים לכל עמוד. אותו נימוק בשלושת
 * שולפי ה-slug שאחריו.
 */
export const getBookBySlug = cache(async (slug: string): Promise<BookWithRelations | null> => {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.bookBySlug(slug) : null;

  const rows = await runBookQuery<BookWithRelations>(
    (select) => supabase.from('books').select(select).eq('slug', slug).eq('is_published', true),
    'getBookBySlug',
    [BOOK_DETAIL_SELECT_V4, BOOK_DETAIL_SELECT_V3, BOOK_DETAIL_SELECT, BOOK_SELECT, BOOK_BASE_SELECT],
  );
  return rows[0] ?? null;
});

/**
 * ספרים קשורים לעמוד הספר, מקובצים לפי *סיבת* הקשר — לא רשימה שטוחה של
 * "עוד ספרים". כל דלי משמש קרוסלה נפרדת עם כותרת שמסבירה את עצמה.
 *
 * "אותן תגיות" נשלף בשני סבבים (מזהי ספרים דרך book_tags, ואז הספרים
 * עצמם) ולא בסינון על טבלה מקוננת: PostgREST תומך בזה רק דרך תחביר
 * !inner עדין שהיה מוסיף עוד מקום לתקלת PGRST201 מהסוג שכבר קרה כאן פעם
 * אחת — שתי שאילתות פשוטות בטוחות יותר משאילתה אחת עדינה.
 */
export interface BookConnections {
  /** קשרים ידניים שהצוות קבע — עדיפות ראשונה, ראו book_relations. */
  manual: BookRelation[];
  sameAuthor: BookWithRelations[];
  /** ריק אם הספר אינו שייך לסדרה. ממוין לפי מיקום הכרך. */
  sameSeries: BookWithRelations[];
  sameCategory: BookWithRelations[];
  sameTags: BookWithRelations[];
}

const EMPTY_CONNECTIONS: BookConnections = {
  manual: [],
  sameAuthor: [],
  sameSeries: [],
  sameCategory: [],
  sameTags: [],
};

/**
 * "להמשיך מכאן" נגזר מכמה קבוצות עם עדיפות יורדת: קשר ידני (שהצוות קבע
 * בעצמו) → סדרה → מחבר → קטגוריה/תגיות. ספר שכבר הופיע בקבוצה גבוהה
 * יותר לא חוזר בקבוצה נמוכה ממנה — אחרת "להמשיך מכאן" מציג את אותו
 * ספר פעמיים בשני שבבי סינון שונים, מה שנראה כמו טעות ולא כמו כוונה.
 *
 * בכוונה אין כאן "נרכשו יחד" או "נצפו לאחריו": שניהם דורשים נתוני
 * רכישה/מעקב מבקרים שאין היום — ראו ההסבר המלא ב-10_book_page_stage_c.sql.
 */
export async function getBookConnections(book: BookWithRelations, limit = 8): Promise<BookConnections> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.connections(book) : EMPTY_CONNECTIONS;

  const tagIds = (book.tags ?? []).map((tag) => tag.id);
  const manual = book.relations ?? [];
  const excluded = new Set<string>([book.id, ...manual.map((relation) => relation.target.id)]);

  const [sameAuthorRaw, sameSeriesRaw, sameCategoryRaw, sameTagsRaw] = await Promise.all([
    book.author_id
      ? runBookQuery<BookWithRelations>(
          (select) =>
            supabase
              .from('books')
              .select(select)
              .eq('is_published', true)
              .eq('author_id', book.author_id!)
              .neq('id', book.id)
              .order('title_he', { ascending: true })
              .limit(limit),
          'getBookConnections:author',
        )
      : Promise.resolve([]),

    book.series_id
      ? runBookQuery<BookWithRelations>(
          (select) =>
            supabase
              .from('books')
              .select(select)
              .eq('is_published', true)
              .eq('series_id', book.series_id!)
              .neq('id', book.id)
              .order('series_position', { ascending: true, nullsFirst: false }),
          'getBookConnections:series',
        )
      : Promise.resolve([]),

    book.category_id
      ? runBookQuery<BookWithRelations>(
          (select) =>
            supabase
              .from('books')
              .select(select)
              .eq('is_published', true)
              .eq('category_id', book.category_id!)
              .neq('id', book.id)
              .order('title_he', { ascending: true })
              .limit(limit),
          'getBookConnections:category',
        )
      : Promise.resolve([]),

    tagIds.length > 0 ? getBooksSharingTags(supabase, tagIds, book.id, limit) : Promise.resolve([]),
  ]);

  // סדרה קודמת למחבר, ומחבר קודם לקטגוריה/תגיות — כל שלב מסנן את מה
  // שכבר הופיע בשלב הקודם ומוסיף את עצמו לרשימת המוצא הבאה.
  const sameSeries = sameSeriesRaw.filter((candidate) => !excluded.has(candidate.id));
  sameSeries.forEach((candidate) => excluded.add(candidate.id));

  const sameAuthor = sameAuthorRaw.filter((candidate) => !excluded.has(candidate.id));
  sameAuthor.forEach((candidate) => excluded.add(candidate.id));

  const sameCategory = sameCategoryRaw.filter((candidate) => !excluded.has(candidate.id));
  sameCategory.forEach((candidate) => excluded.add(candidate.id));

  const sameTags = sameTagsRaw.filter((candidate) => !excluded.has(candidate.id));

  return { manual, sameAuthor, sameSeries, sameCategory, sameTags };
}

async function getBooksSharingTags(
  supabase: NonNullable<ReturnType<typeof createStaticClient>>,
  tagIds: string[],
  excludeId: string,
  limit: number,
): Promise<BookWithRelations[]> {
  // תקרה על שאילתת הקישורים: תגית נפוצה ("הלכה") על מאות ספרים הייתה
  // מחזירה את כל השורות רק כדי להיזרק ב-slice שאחרי.
  const links = await supabase
    .from('book_tags')
    .select('book_id')
    .in('tag_id', tagIds)
    .neq('book_id', excludeId)
    .limit(Math.max(limit * 4, 40));
  if (links.error) {
    warn('getBookConnections:tags', links.error);
    return [];
  }

  // ספר עם כמה תגיות משותפות חוזר כמה פעמים ב-book_tags — הייחוד כאן
  const ids = [...new Set((links.data as { book_id: string }[]).map((row) => row.book_id))].slice(0, limit);
  if (ids.length === 0) return [];

  return runBookQuery<BookWithRelations>(
    (select) => supabase.from('books').select(select).eq('is_published', true).in('id', ids),
    'getBookConnections:tags',
  );
}

/** הכותרים האחרונים שנוספו — לעמוד הבית. */
export async function getRecentBooks(limit = 6): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.books().slice(0, limit) : [];

  return runBookQuery<BookWithRelations>(
    (select) =>
      supabase
        .from('books')
        .select(select)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(limit),
    'getRecentBooks',
  );
}

/**
 * הספרים הנצפים ביותר — לפי view_count (ראו increment_book_view
 * ב-10_book_page_stage_c.sql), לא לפי page_views: המונה כבר קיים על
 * הספר עצמו, ומתעדכן בכל טעינת עמוד ספר אמיתית.
 */
export async function getMostViewedBooks(limit = 5): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) {
    return isDemoContent ? [...demo.books()].sort((a, b) => b.view_count - a.view_count).slice(0, limit) : [];
  }

  return runBookQuery<BookWithRelations>(
    (select) =>
      supabase
        .from('books')
        .select(select)
        .eq('is_published', true)
        .order('view_count', { ascending: false })
        .limit(limit),
    'getMostViewedBooks',
  );
}

/**
 * ספרים לפי רשימת מזהים מסודרת — למדף האוצר בעמוד הבית (ראו
 * site_settings.extra.shelf_book_ids, נבחר בהגדרות קטלוג וחנות).
 * מחזיר לפי סדר המזהים שהתקבל, לא לפי סדר ההחזרה השרירותי של .in().
 */
export async function getBooksByIds(ids: string[]): Promise<BookWithRelations[]> {
  if (ids.length === 0) return [];
  const supabase = createStaticClient();
  if (!supabase) return [];

  const books = await runBookQuery<BookWithRelations>(
    (select) => supabase.from('books').select(select).in('id', ids).eq('is_published', true),
    'getBooksByIds',
  );

  const byId = new Map(books.map((book) => [book.id, book]));
  return ids.map((id) => byId.get(id)).filter((book): book is BookWithRelations => Boolean(book));
}

/**
 * מונה צפיות גס — ראו increment_book_view ב-10_book_page_stage_c.sql.
 *
 * נקרא מ-Server Action בצד הלקוח (recordBookView) ולא מתוך רינדור
 * העמוד עצמו: עמוד הספר עובר ISR עם revalidate=60, כלומר קריאה כאן
 * הייתה נספרת פעם אחת לכל בנייה מחדש של המטמון ולא פעם אחת לכל ביקור —
 * מונה שסופר לפי קצב המטמון ולא לפי ביקורים אמיתיים חסר משמעות.
 */
export async function incrementBookView(slug: string): Promise<void> {
  const supabase = createStaticClient();
  if (!supabase) return;

  const { error } = await supabase.rpc('increment_book_view', { target_slug: slug });
  if (error) console.error('[data:incrementBookView]', error);
}

/**
 * מונה ספרים מפורסמים פר מחבר — לרשימת המחברים. שליפת עמודה אחת במקום
 * getBooks() המלא (כל העמודות + כל ה-joins) שרשימת המחברים משכה בעבר
 * רק כדי לספור.
 */
export async function getBookCountsByAuthor(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const supabase = createStaticClient();
  if (!supabase) {
    if (isDemoContent) {
      for (const book of demo.books()) {
        if (book.author_id) counts.set(book.author_id, (counts.get(book.author_id) ?? 0) + 1);
      }
    }
    return counts;
  }

  const { data, error } = await supabase.from('books').select('author_id').eq('is_published', true);
  warn('getBookCountsByAuthor', error);
  for (const row of (data ?? []) as { author_id: string | null }[]) {
    if (row.author_id) counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  }
  return counts;
}

export interface BookOptionRow {
  id: string;
  title_he: string;
  title_en: string | null;
  author_name_he: string | null;
  author_name_en: string | null;
  author: Pick<Author, 'id' | 'slug' | 'name_he' | 'name_en'> | null;
}

/**
 * רשימה קומפקטית לבורר הספרים בטופס יצירת הקשר ("הערה על ספר") — שם
 * ומחבר בלבד. עמוד ה-contact משך בעבר את getBooks() המלא בשביל שלושת
 * השדות האלה.
 */
export async function getBookOptions(): Promise<BookOptionRow[]> {
  const supabase = createStaticClient();
  if (!supabase) {
    return isDemoContent ? (demo.books() as unknown as BookOptionRow[]) : [];
  }

  const { data, error } = await supabase
    .from('books')
    .select('id, title_he, title_en, author_name_he, author_name_en, author:authors(id, slug, name_he, name_en)')
    .eq('is_published', true)
    .order('title_he');
  warn('getBookOptions', error);
  return ((data ?? []) as unknown as BookOptionRow[]);
}

export async function getBookSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.books().map((b) => b.slug) : [];
  const { data } = await supabase.from('books').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Book, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* מחברים                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAuthors(): Promise<Author[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.authors() : [];

  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('name_he', { ascending: true });

  warn('getAuthors', error);
  return (data as Author[] | null) ?? [];
}

export const getAuthorBySlug = cache(async (slug: string): Promise<Author | null> => {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.authorBySlug(slug) : null;

  const { data, error } = await supabase
    .from('authors')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  warn('getAuthorBySlug', error);
  return (data as Author | null) ?? null;
});

export async function getBooksByAuthor(authorId: string): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.booksByAuthor(authorId) : [];

  return runBookQuery<BookWithRelations>(
    (select) =>
      supabase
        .from('books')
        .select(select)
        .eq('is_published', true)
        .eq('author_id', authorId)
        .order('title_he', { ascending: true }),
    'getBooksByAuthor',
  );
}

export async function getAuthorSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.authors().map((a) => a.slug) : [];
  const { data } = await supabase.from('authors').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Author, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* קטגוריות                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCategories(): Promise<Category[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.categories() : [];

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  warn('getCategories', error);
  return (data as Category[] | null) ?? [];
}

/* -------------------------------------------------------------------------- */
/* תגיות ומאפיינים                                                             */
/* -------------------------------------------------------------------------- */

export async function getTags(): Promise<Tag[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase.from('tags').select('*').order('name_he');
  warn('getTags', error);
  return (data as Tag[] | null) ?? [];
}

/* -------------------------------------------------------------------------- */
/* טופס יצירת קשר: תחומי פנייה ושדות מותאמים                                    */
/* -------------------------------------------------------------------------- */

export async function getContactTopics(): Promise<ContactTopic[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('contact_topics')
    .select('*')
    .eq('is_published', true)
    .order('sort_order');
  warn('getContactTopics', error);
  return (data as ContactTopic[] | null) ?? [];
}

export async function getContactFields(): Promise<ContactField[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('contact_fields')
    .select('*')
    .eq('is_published', true)
    .order('sort_order');
  warn('getContactFields', error);
  return (data as ContactField[] | null) ?? [];
}

export async function getAttributes(): Promise<AttributeWithValues[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('attributes')
    .select('*, values:attribute_values(*)')
    .order('sort_order');

  warn('getAttributes', error);
  return filterVisibleAttributes(
    ((data as (Attribute & { values: AttributeValue[] })[] | null) ?? []).map((attribute) => ({
      ...attribute,
      values: [...attribute.values].sort((a, b) => a.sort_order - b.sort_order),
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* פעילות                                                                      */
/* -------------------------------------------------------------------------- */

export async function getActivities(): Promise<Activity[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.activities() : [];

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  warn('getActivities', error);
  return (data as Activity[] | null) ?? [];
}

export const getActivityBySlug = cache(async (slug: string): Promise<Activity | null> => {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.activityBySlug(slug) : null;

  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  warn('getActivityBySlug', error);
  return (data as Activity | null) ?? null;
});

export async function getActivitySlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.activities().map((a) => a.slug) : [];
  const { data } = await supabase.from('activities').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Activity, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* אירועים                                                                     */
/* -------------------------------------------------------------------------- */

export async function getEvents(): Promise<EventRecord[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.events() : [];

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('is_published', true)
    .order('event_date', { ascending: false, nullsFirst: false });

  warn('getEvents', error);
  return (data as EventRecord[] | null) ?? [];
}

/**
 * blocks:event_blocks(*) נשלף רק כאן, לא ב-getEvents(): אותו לקח בדיוק
 * שנלמד עם books/tags — select משותף לרשימות אסור שיישען על טבלה/עמודה
 * ששלב חדש הוסיף, אחרת מיגרציה שטרם רצתה מפילה את כל הרשימה ולא רק את
 * העמוד הבודד. getEvents() ממשיך להשתמש ב-'*' פשוט ואינו מושפע כלל.
 */
const EVENT_DETAIL_SELECT = `*, blocks:event_blocks ( * ), media:event_media ( * ), chapters:event_chapters ( * )`;
const EVENT_DETAIL_SELECT_LEGACY = `*, blocks:event_blocks ( * )`;

/** אירוע מלא לעמוד התצוגה — כולל מדיית הסיפור והשלבים (מיגרציה 48). */
export type EventDetail = EventRecord & {
  media?: EventMediaItem[];
  chapters?: EventChapter[];
};

export const getEventBySlug = cache(async (slug: string): Promise<EventDetail | null> => {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.eventBySlug(slug) : null;

  const raw = await withSchemaFallback(
    (select) =>
      supabase.from('events').select(select).eq('slug', slug).eq('is_published', true).maybeSingle(),
    'getEventBySlug',
    [EVENT_DETAIL_SELECT, EVENT_DETAIL_SELECT_LEGACY, '*'],
  );

  if (!raw) return null;

  const event = raw as EventDetail & { blocks?: unknown };
  const blocks = Array.isArray(event.blocks)
    ? [...(event.blocks as EventBlock[])].sort((a, b) => a.sort_order - b.sort_order)
    : undefined;
  const media = Array.isArray(event.media)
    ? [...event.media].filter((item) => item.is_visible).sort((a, b) => a.sort_order - b.sort_order)
    : undefined;
  const chapters = Array.isArray(event.chapters)
    ? [...event.chapters].sort((a, b) => a.sort_order - b.sort_order)
    : undefined;
  return { ...event, blocks, media, chapters };
});

export async function getEventSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.events().map((e) => e.slug) : [];
  const { data } = await supabase.from('events').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<EventRecord, 'slug'>) => row.slug);
}

export interface SuggestedEvent {
  slug: string;
  title_he: string;
  title_en: string | null;
  cover_image_url: string | null;
}

/**
 * [1.14] אירוע אחר עם גלריה — להצעת "מעבר לגלריה אחרת" בסיום דפדוף
 * ה-Reels. עדיפות לאירועים עם מדיה בטבלה החדשה (event_media); אירוע
 * ישן עם גלריית jsonb בלבד עדיין נספר כמועמד. לוקחים כמה מועמדים
 * (הקרובים ביותר בתאריך) ובוחרים את הראשון שבאמת יש לו מה להראות —
 * בקטלוג אירועים מוסדי (לא זרם חדשות), אין טעם בשאילתה מורכבת יותר.
 */
export async function getOtherEventWithMedia(
  currentEventId: string,
  currentSlug: string,
): Promise<SuggestedEvent | null> {
  const supabase = createStaticClient();
  if (!supabase) return null;

  const { data: candidates, error } = await supabase
    .from('events')
    .select('id, slug, title_he, title_en, cover_image_url, gallery')
    .eq('is_published', true)
    .neq('slug', currentSlug)
    .order('event_date', { ascending: false, nullsFirst: false })
    .limit(8);
  warn('getOtherEventWithMedia', error);
  if (!candidates || candidates.length === 0) return null;

  const ids = candidates.map((row) => row.id);
  const { data: mediaRows } = await supabase.from('event_media').select('event_id').in('event_id', ids);
  const idsWithMedia = new Set((mediaRows ?? []).map((row) => row.event_id as string));

  const match = candidates.find(
    (row) => row.id !== currentEventId && (idsWithMedia.has(row.id) || (row.gallery?.length ?? 0) > 0),
  );
  if (!match) return null;

  return {
    slug: match.slug,
    title_he: match.title_he,
    title_en: match.title_en,
    cover_image_url: match.cover_image_url,
  };
}

/* -------------------------------------------------------------------------- */
/* עמודי תוכן והגדרות                                                          */
/* -------------------------------------------------------------------------- */

export async function getPageBySlug(slug: string): Promise<ContentPage | null> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.page(slug) : null;

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  warn('getPageBySlug', error);
  return (data as ContentPage | null) ?? null;
}

const EMPTY_SETTINGS: SiteSettings = {
  id: 1,
  logo_url: null,
  logo_dark_url: null,
  contact: {},
  social_links: {},
  store_enabled: false,
  extra: {},
  updated_at: new Date(0).toISOString(),
};

/**
 * ההגדרות נצרכות ב-layout (כותרת עליונה ותחתונה) וגם בכמה עמודים באותה
 * בקשה. cache() מונע שאילתה חוזרת לכל צרכן.
 */
/**
 * [1.11] הגופנים המותקנים הפעילים — ל-CustomFontsStyle בשני ה-root
 * layouts ולבורר הגופנים בעורך. cache() כי נקרא בכל עמוד.
 */
export const getCustomFonts = cache(async (): Promise<CustomFont[]> => {
  const supabase = createStaticClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('custom_fonts')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  warn('getCustomFonts', error);
  return (data as CustomFont[] | null) ?? [];
});

export const getSiteSettings = cache(async (): Promise<SiteSettings> => {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.settings() : EMPTY_SETTINGS;

  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();

  warn('getSiteSettings', error);
  return (data as SiteSettings | null) ?? EMPTY_SETTINGS;
});

/* -------------------------------------------------------------------------- */
/* באנרים                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * הבאנרים המוצגים כרגע: מפורסמים, ובתוך חלון התאריכים אם הוגדר כזה.
 * הסינון על החלון נעשה כאן ולא ב-SQL כדי שהתוצאה תהיה עקבית עם ה-ISR —
 * העמוד נבנה מחדש כל שעה, וזו הרזולוציה הרלוונטית ממילא.
 */
export async function getBanners(): Promise<Banner[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.banners() : [];

  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true });

  warn('getBanners', error);

  const now = Date.now();
  return ((data as Banner[] | null) ?? []).filter((banner) => {
    // starts_at/ends_at הם שדות date (יום בלבד). תאריך כזה מתפרש כחצות
    // UTC, ולכן באנר שאמור להסתיים "ביום האירוע" היה נעלם ב-00:00 UTC
    // (‏02:00/03:00 בישראל) של אותו יום — עד יממה מוקדם מהצפוי. הפתרון:
    // הכללת כל יום ה-ends_at — הבאנר תקף עד סוף אותו יום (חצות UTC של
    // המחרת). זמן (T...) בשדה, אם יהיה, נשמר כפי שהוא.
    if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return false;
    if (banner.ends_at) {
      const raw = banner.ends_at;
      const end = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(raw).getTime() + 24 * 60 * 60_000 // date-only → עד סוף היום
        : new Date(raw).getTime();
      if (end < now) return false;
    }
    return true;
  });
}
