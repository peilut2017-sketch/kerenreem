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
const BOOK_BASE_SELECT = `
  *,
  author:authors ( id, slug, name_he, name_en ),
  category:categories ( id, slug, name_he, name_en )
`;

const BOOK_SELECT = `
  ${BOOK_BASE_SELECT},
  tags:book_tags ( tag:tags ( id, slug, name_he, name_en ) ),
  attributeValues:book_attributes ( value:attribute_values ( id, slug, name_he, attribute_id ) )
`;

/**
 * מריץ שליפת ספרים עם ההצטרפות המלאה, ונופל לבסיסית כשהיא אינה אפשרית.
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
): Promise<T[]> {
  const full = await build(BOOK_SELECT);
  if (!full.error) return shapeBooks(full.data) as T[];

  if (full.error.code !== '42P01' && full.error.code !== 'PGRST200') {
    warn(scope, full.error);
    return [];
  }

  console.warn(
    `[data:${scope}] טבלאות התגיות והמאפיינים חסרות — יש להריץ את supabase/08_pim_stage_a.sql. ` +
      'הקטלוג מוגש בינתיים בלעדיהן.',
  );

  const base = await build(BOOK_BASE_SELECT);
  warn(scope, base.error);
  return shapeBooks(base.data) as T[];
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

function shapeBook(row: unknown): BookWithRelations {
  const book = row as BookWithRelations & { tags?: unknown; attributeValues?: unknown };
  return {
    ...book,
    tags: flatten(book.tags, 'tag'),
    attributeValues: flatten(book.attributeValues, 'value'),
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
      supabase
        .from('books')
        .select(select)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('title_he', { ascending: true }),
    'getBooks',
  );
}

export async function getBookBySlug(slug: string): Promise<BookWithRelations | null> {
  const supabase = createStaticClient();
  if (!supabase) return isDemoContent ? demo.bookBySlug(slug) : null;

  const rows = await runBookQuery<BookWithRelations>(
    (select) => supabase.from('books').select(select).eq('slug', slug).eq('is_published', true),
    'getBookBySlug',
  );
  return rows[0] ?? null;
}

/** ספרים נוספים להצגה בתחתית עמוד ספר — קודם מאותו מחבר, ואז מאותה קטגוריה. */
export async function getRelatedBooks(book: BookWithRelations, limit = 4): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const collected: BookWithRelations[] = [];

  if (book.author_id) {
    collected.push(
      ...(await runBookQuery<BookWithRelations>(
        (select) =>
          supabase
            .from('books')
            .select(select)
            .eq('is_published', true)
            .eq('author_id', book.author_id!)
            .neq('id', book.id)
            .limit(limit),
        'getRelatedBooks',
      )),
    );
  }

  if (collected.length < limit && book.category_id) {
    const sameCategory = await runBookQuery<BookWithRelations>(
      (select) =>
        supabase
          .from('books')
          .select(select)
          .eq('is_published', true)
          .eq('category_id', book.category_id!)
          .neq('id', book.id)
          .limit(limit),
      'getRelatedBooks',
    );

    for (const candidate of sameCategory) {
      if (collected.length >= limit) break;
      if (!collected.some((existing) => existing.id === candidate.id)) collected.push(candidate);
    }
  }

  return collected.slice(0, limit);
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
        .order('sort_order', { ascending: true }),
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
