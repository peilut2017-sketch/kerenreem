import 'server-only';
import { createStaticClient } from './supabase/server';
import type {
  Activity,
  Author,
  Book,
  BookWithRelations,
  Category,
  ContentPage,
  EventRecord,
  SiteSettings,
} from './supabase/types';

/**
 * שכבת קריאה לתוכן הציבורי.
 *
 * כל פונקציה מחזירה ערך ריק (מערך ריק / null) כשהמסד אינו מוגדר או
 * כששליפה נכשלת. העמודים מציגים מצב ריק במקום ליפול — אתר תוכן לא צריך
 * להיעלם בגלל תקלת רשת רגעית.
 */

const BOOK_SELECT = `
  *,
  author:authors ( id, slug, name_he, name_en ),
  category:categories ( id, slug, name_he, name_en )
`;

function warn(scope: string, error: unknown) {
  if (error) console.error(`[data:${scope}]`, error);
}

/* -------------------------------------------------------------------------- */
/* ספרים                                                                       */
/* -------------------------------------------------------------------------- */

export async function getBooks(): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('title_he', { ascending: true });

  warn('getBooks', error);
  return (data as BookWithRelations[] | null) ?? [];
}

export async function getBookBySlug(slug: string): Promise<BookWithRelations | null> {
  const supabase = createStaticClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  warn('getBookBySlug', error);
  return (data as BookWithRelations | null) ?? null;
}

/** ספרים נוספים להצגה בתחתית עמוד ספר — קודם מאותו מחבר, ואז מאותה קטגוריה. */
export async function getRelatedBooks(book: BookWithRelations, limit = 4): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const collected: BookWithRelations[] = [];

  if (book.author_id) {
    const { data } = await supabase
      .from('books')
      .select(BOOK_SELECT)
      .eq('is_published', true)
      .eq('author_id', book.author_id)
      .neq('id', book.id)
      .limit(limit);
    collected.push(...((data as BookWithRelations[] | null) ?? []));
  }

  if (collected.length < limit && book.category_id) {
    const { data } = await supabase
      .from('books')
      .select(BOOK_SELECT)
      .eq('is_published', true)
      .eq('category_id', book.category_id)
      .neq('id', book.id)
      .limit(limit);

    for (const candidate of (data as BookWithRelations[] | null) ?? []) {
      if (collected.length >= limit) break;
      if (!collected.some((existing) => existing.id === candidate.id)) collected.push(candidate);
    }
  }

  return collected.slice(0, limit);
}

/** הכותרים האחרונים שנוספו — לעמוד הבית. */
export async function getRecentBooks(limit = 6): Promise<BookWithRelations[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  warn('getRecentBooks', error);
  return (data as BookWithRelations[] | null) ?? [];
}

export async function getBookSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];
  const { data } = await supabase.from('books').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Book, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* מחברים                                                                      */
/* -------------------------------------------------------------------------- */

export async function getAuthors(): Promise<Author[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

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
  if (!supabase) return null;

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
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('books')
    .select(BOOK_SELECT)
    .eq('is_published', true)
    .eq('author_id', authorId)
    .order('sort_order', { ascending: true });

  warn('getBooksByAuthor', error);
  return (data as BookWithRelations[] | null) ?? [];
}

export async function getAuthorSlugs(): Promise<string[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];
  const { data } = await supabase.from('authors').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Author, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* קטגוריות                                                                    */
/* -------------------------------------------------------------------------- */

export async function getCategories(): Promise<Category[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  warn('getCategories', error);
  return (data as Category[] | null) ?? [];
}

/* -------------------------------------------------------------------------- */
/* פעילות                                                                      */
/* -------------------------------------------------------------------------- */

export async function getActivities(): Promise<Activity[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

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
  if (!supabase) return null;

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
  if (!supabase) return [];
  const { data } = await supabase.from('activities').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<Activity, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* אירועים                                                                     */
/* -------------------------------------------------------------------------- */

export async function getEvents(): Promise<EventRecord[]> {
  const supabase = createStaticClient();
  if (!supabase) return [];

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
  if (!supabase) return null;

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
  if (!supabase) return [];
  const { data } = await supabase.from('events').select('slug').eq('is_published', true);
  return (data ?? []).map((row: Pick<EventRecord, 'slug'>) => row.slug);
}

/* -------------------------------------------------------------------------- */
/* עמודי תוכן והגדרות                                                          */
/* -------------------------------------------------------------------------- */

export async function getPageBySlug(slug: string): Promise<ContentPage | null> {
  const supabase = createStaticClient();
  if (!supabase) return null;

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

export async function getSiteSettings(): Promise<SiteSettings> {
  const supabase = createStaticClient();
  if (!supabase) return EMPTY_SETTINGS;

  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();

  warn('getSiteSettings', error);
  return (data as SiteSettings | null) ?? EMPTY_SETTINGS;
}
