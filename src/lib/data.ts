import 'server-only';
import { cache } from 'react';
import { createStaticClient } from './supabase/server';
import { demo, isDemoContent } from './demo-content';
import type {
  Activity,
  Attribute,
  AttributeValue,
  AttributeWithValues,
  Banner,
  Author,
  Book,
  BookWithRelations,
  Category,
  ContentPage,
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

const BOOK_SELECT = `
  ${BOOK_BASE_SELECT},
  tags:book_tags ( tag:tags ( id, slug, name_he, name_en, description_he ) ),
  attributeValues:book_attributes ( value:attribute_values ( id, slug, name_he, attribute_id ) )
`;

/**
 * שליפה מלאה, רק לעמוד הספר הבודד: מוסיפה סדרה, גלריה ותוכן עניינים —
 * שדות ש-08_pim_stage_a.sql הקודם לא הכיר, ושרשימות/כרטיסים לא צריכים
 * (join מיותר בכל טעינת קטלוג של מאות ספרים).
 *
 * series:series!books_series_id_fkey ולא series:series סתם, מאותה סיבה
 * בדיוק שהוסברה למעלה על category: מסלול קשר אחד היום, אבל אילוץ מפורש
 * הוא הבטוח כשמישהו יוסיף בעתיד טבלת קישור נוספת לסדרות.
 */
const BOOK_DETAIL_SELECT = `
  ${BOOK_SELECT},
  series:series!books_series_id_fkey ( id, slug, name_he, name_en ),
  images:book_images ( id, book_id, image_url, alt, caption_he, sort_order ),
  toc:book_toc ( id, book_id, title_he, level, page_number, summary_he, sort_order )
`;

/**
 * מריץ שליפת ספרים, ונופל משכבה עשירה יותר לבסיסית כשהיא אינה אפשרית.
 * 42P01 = הטבלה אינה קיימת, PGRST200 = הקשר אינו מוכר ל-PostgREST.
 *
 * הניסיון המלא נעשה מחדש בכל קריאה, בלי "לזכור" כשל קודם. גרסה מוקדמת
 * שמרה דגל ברמת המודול (pimTablesMissing) כדי לחסוך ניסיון חוזר — אבל
 * מודול בשרת נטען פעם אחת לתהליך, ותהליך חם ממשיך לשרת בקשות רבות. אם
 * הבקשה הראשונה על תהליך נתון נתקלה בטבלה חסרה, הדגל ננעל על true
 * לצמיתות עבור אותו תהליך, גם אחרי שהטבלאות נוצרו — והקטלוג ממשיך
 * להיראות כאילו אין לו תגיות אף שהן קיימות. עלות הניסיון החוזר זניחה.
 */
async function runBookQuery<T>(
  build: (select: string) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
  scope: string,
  selects: readonly string[] = [BOOK_SELECT, BOOK_BASE_SELECT],
): Promise<T[]> {
  for (let i = 0; i < selects.length; i += 1) {
    const result = await build(selects[i]);
    if (!result.error) return shapeBooks(result.data) as T[];

    const isMissingLayer = result.error.code === '42P01' || result.error.code === 'PGRST200';
    const isLast = i === selects.length - 1;

    if (!isMissingLayer || isLast) {
      warn(scope, result.error);
      return [];
    }

    console.warn(
      `[data:${scope}] שכבת נתונים חסרה (שלב ${i + 1} מתוך ${selects.length}) — ` +
        'יש להריץ את קובצי ה-SQL של מכון קרן רא״ם לפי הסדר. נופל לשכבה הבסיסית יותר.',
    );
  }

  return [];
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

function shapeBook(row: unknown): BookWithRelations {
  const book = row as BookWithRelations & { tags?: unknown; attributeValues?: unknown };
  return {
    ...book,
    tags: flatten(book.tags, 'tag'),
    attributeValues: flatten(book.attributeValues, 'value'),
    images: bySortOrder(book.images),
    toc: bySortOrder(book.toc),
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
  );
}

export async function getBookBySlug(slug: string): Promise<BookWithRelations | null> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.bookBySlug(slug) : null;

  const rows = await runBookQuery<BookWithRelations>(
    (select) => supabase.from('books').select(select).eq('slug', slug).eq('is_published', true),
    'getBookBySlug',
    [BOOK_DETAIL_SELECT, BOOK_SELECT, BOOK_BASE_SELECT],
  );
  return rows[0] ?? null;
}

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
  sameAuthor: BookWithRelations[];
  /** ריק אם הספר אינו שייך לסדרה. ממוין לפי מיקום הכרך. */
  sameSeries: BookWithRelations[];
  sameCategory: BookWithRelations[];
  sameTags: BookWithRelations[];
}

const EMPTY_CONNECTIONS: BookConnections = {
  sameAuthor: [],
  sameSeries: [],
  sameCategory: [],
  sameTags: [],
};

export async function getBookConnections(book: BookWithRelations, limit = 8): Promise<BookConnections> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.connections(book) : EMPTY_CONNECTIONS;

  const tagIds = (book.tags ?? []).map((tag) => tag.id);

  const [sameAuthor, sameSeries, sameCategory, sameTags] = await Promise.all([
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

  return { sameAuthor, sameSeries, sameCategory, sameTags };
}

async function getBooksSharingTags(
  supabase: NonNullable<ReturnType<typeof createStaticClient>>,
  tagIds: string[],
  excludeId: string,
  limit: number,
): Promise<BookWithRelations[]> {
  const links = await supabase.from('book_tags').select('book_id').in('tag_id', tagIds).neq('book_id', excludeId);
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

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
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
}

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

export async function getAttributes(): Promise<AttributeWithValues[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('attributes')
    .select('*, values:attribute_values(*)')
    .order('sort_order');

  warn('getAttributes', error);
  return ((data as (Attribute & { values: AttributeValue[] })[] | null) ?? []).map((attribute) => ({
    ...attribute,
    values: [...attribute.values].sort((a, b) => a.sort_order - b.sort_order),
  }));
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

export async function getActivityBySlug(slug: string): Promise<Activity | null> {
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
}

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

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.eventBySlug(slug) : null;

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  warn('getEventBySlug', error);
  return (data as EventRecord | null) ?? null;
}

export async function getEventSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.events().map((e) => e.slug) : [];
  const { data } = await supabase.from('events').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<EventRecord, 'slug'>) => row.slug);
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
    if (banner.starts_at && new Date(banner.starts_at).getTime() > now) return false;
    if (banner.ends_at && new Date(banner.ends_at).getTime() < now) return false;
    return true;
  });
}
