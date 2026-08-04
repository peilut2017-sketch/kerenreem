import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Activity,
  Attribute,
  AttributeValue,
  AttributeWithValues,
  Banner,
  Author,
  Book,
  BookImage,
  BookPreviewPage,
  BookRelations,
  BookTocEntry,
  Category,
  ContactAttachment,
  ContactField,
  ContactTopic,
  Tag,
  ContentPage,
  EventBlock,
  EventRecord,
  Profile,
  Series,
  SiteSettings,
} from '@/lib/supabase/types';

/**
 * שליפות לממשק הניהול. בניגוד ל-lib/data.ts, כאן נשלפות גם טיוטות
 * (is_published=false) — ה-RLS מתיר זאת רק למשתמש עם תפקיד עורך ומעלה.
 */

async function client() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase אינו מוגדר');
  return supabase;
}

export type BookRow = Book & { author: Pick<Author, 'name_he'> | null };

export async function listBooks(): Promise<BookRow[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors ( name_he )')
    .order('updated_at', { ascending: false });
  return (data as BookRow[] | null) ?? [];
}

/**
 * מזהי הספרים שנושאים תגית אחת לפחות.
 *
 * מד ההשלמה ברשימה זקוק רק ל"יש/אין תגית" לכל ספר, לא לרשימת התגיות
 * עצמה — שליפה אחת של book_id בלבד, ולא שאילתה מקוננת פר-ספר.
 */
export async function listBookIdsWithTags(): Promise<Set<string>> {
  const supabase = await client();
  const { data } = await supabase.from('book_tags').select('book_id');
  return new Set((data as { book_id: string }[] | null)?.map((row) => row.book_id) ?? []);
}

/**
 * שליפות ייעודיות לדשבורד.
 *
 * קודם לכן הדשבורד שלף את *כל* הספרים ואת *כל* האירועים רק כדי להציג חמש
 * שורות מכל אחד. בקטלוג של מאות כותרים זו העברת נתונים מיותרת בכל טעינה.
 */
export async function listRecentBooks(limit = 5): Promise<BookRow[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('books')
    .select('id, title_he, is_published, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data as BookRow[] | null) ?? [];
}

export async function listDraftBooks(limit = 5): Promise<BookRow[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('books')
    .select('id, title_he, is_published, updated_at')
    .eq('is_published', false)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return (data as BookRow[] | null) ?? [];
}

export async function listUpcomingEvents(limit = 5): Promise<EventRecord[]> {
  const supabase = await client();
  const today = new Date();
  today.setDate(today.getDate() - 1);
  const { data } = await supabase
    .from('events')
    .select('id, title_he, event_date, event_date_he, is_published')
    .gte('event_date', today.toISOString().slice(0, 10))
    .order('event_date', { ascending: true })
    .limit(limit);
  return (data as EventRecord[] | null) ?? [];
}

export async function getBook(id: string): Promise<Book | null> {
  const supabase = await client();
  const { data } = await supabase.from('books').select('*').eq('id', id).maybeSingle();
  return (data as Book | null) ?? null;
}

export async function listAuthorsAdmin(): Promise<Author[]> {
  const supabase = await client();
  const { data } = await supabase.from('authors').select('*').order('name_he');
  return (data as Author[] | null) ?? [];
}

export async function getAuthor(id: string): Promise<Author | null> {
  const supabase = await client();
  const { data } = await supabase.from('authors').select('*').eq('id', id).maybeSingle();
  return (data as Author | null) ?? null;
}

/* -------------------------------------------------------------------------- */
/* שכבת המידע: תגיות, מאפיינים וקשרי הספר                                      */
/* -------------------------------------------------------------------------- */

export async function listTags(): Promise<Tag[]> {
  const supabase = await client();
  const { data } = await supabase.from('tags').select('*').order('name_he');
  return (data as Tag[] | null) ?? [];
}

export async function getTag(id: string): Promise<Tag | null> {
  const supabase = await client();
  const { data } = await supabase.from('tags').select('*').eq('id', id).maybeSingle();
  return (data as Tag | null) ?? null;
}

/** מניין הספרים הנושאים כל תגית — לאזהרה לפני מחיקה. */
export async function countBooksByTag(): Promise<Map<string, number>> {
  const supabase = await client();
  const { data } = await supabase.from('book_tags').select('tag_id');

  const counts = new Map<string, number>();
  for (const row of (data as { tag_id: string }[] | null) ?? []) {
    counts.set(row.tag_id, (counts.get(row.tag_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * המאפיינים עם הערכים שלהם, בשליפה אחת.
 *
 * שתי שאילתות נפרדות היו מחייבות הרכבה ידנית וסבב רשת נוסף בכל פתיחת
 * טופס. ההצטרפות המקוננת של PostgREST עושה זאת בבקשה אחת.
 */
export async function listAttributes(): Promise<AttributeWithValues[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('attributes')
    .select('*, values:attribute_values(*)')
    .order('sort_order');

  return ((data as (Attribute & { values: AttributeValue[] })[] | null) ?? []).map((attribute) => ({
    ...attribute,
    values: [...attribute.values].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** הקשרים הנוכחיים של ספר, לטעינת הטופס. */
export async function getBookRelations(bookId: string): Promise<BookRelations> {
  const supabase = await client();

  const [tags, categories, attributes] = await Promise.all([
    supabase.from('book_tags').select('tag_id').eq('book_id', bookId),
    supabase.from('book_categories').select('category_id').eq('book_id', bookId),
    supabase.from('book_attributes').select('value_id').eq('book_id', bookId),
  ]);

  return {
    tagIds: (tags.data ?? []).map((row: { tag_id: string }) => row.tag_id),
    categoryIds: (categories.data ?? []).map((row: { category_id: string }) => row.category_id),
    attributeValueIds: (attributes.data ?? []).map((row: { value_id: string }) => row.value_id),
  };
}

export async function getBookImages(bookId: string): Promise<BookImage[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('book_images')
    .select('*')
    .eq('book_id', bookId)
    .order('sort_order');
  return (data as BookImage[] | null) ?? [];
}

export async function getBookToc(bookId: string): Promise<BookTocEntry[]> {
  const supabase = await client();
  const { data } = await supabase.from('book_toc').select('*').eq('book_id', bookId).order('sort_order');
  return (data as BookTocEntry[] | null) ?? [];
}

export async function getBookPreviewPages(bookId: string): Promise<BookPreviewPage[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('book_preview_pages')
    .select('*')
    .eq('book_id', bookId)
    .order('page_number');
  return (data as BookPreviewPage[] | null) ?? [];
}

export async function listCategoriesAdmin(): Promise<Category[]> {
  const supabase = await client();
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  return (data as Category[] | null) ?? [];
}

export async function getCategory(id: string): Promise<Category | null> {
  const supabase = await client();
  const { data } = await supabase.from('categories').select('*').eq('id', id).maybeSingle();
  return (data as Category | null) ?? null;
}

export async function listSeriesAdmin(): Promise<Series[]> {
  const supabase = await client();
  const { data } = await supabase.from('series').select('*').order('name_he');
  return (data as Series[] | null) ?? [];
}

export async function getSeries(id: string): Promise<Series | null> {
  const supabase = await client();
  const { data } = await supabase.from('series').select('*').eq('id', id).maybeSingle();
  return (data as Series | null) ?? null;
}

/**
 * מניין הספרים של כל מחבר. מחיקת מחבר אינה מוחקת את ספריו אלא מנתקת את
 * השיוך בשקט (on delete set null), ובקטלוג תורני אובדן הייחוס הוא נזק
 * ממשי — לכן המסך מזהיר לפני כן.
 */
export async function countBooksByAuthor(): Promise<Map<string, number>> {
  const supabase = await client();
  const { data } = await supabase.from('books').select('author_id');

  const counts = new Map<string, number>();
  for (const row of (data as { author_id: string | null }[] | null) ?? []) {
    if (row.author_id) counts.set(row.author_id, (counts.get(row.author_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * מניין הספרים בכל קטגוריה — כדי שמסך הקטגוריות יראה מה בשימוש, ובעיקר
 * כדי להזהיר לפני מחיקה: גם כאן השיוך מנותק בשקט ולא נחסם.
 */
export async function countBooksByCategory(): Promise<Map<string, number>> {
  const supabase = await client();
  const { data } = await supabase.from('books').select('category_id');

  const counts = new Map<string, number>();
  for (const row of (data as { category_id: string | null }[] | null) ?? []) {
    if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

/** מניין הספרים בכל סדרה — לאזהרה לפני מחיקה, כמו countBooksByCategory. */
export async function countBooksBySeries(): Promise<Map<string, number>> {
  const supabase = await client();
  const { data } = await supabase.from('books').select('series_id');

  const counts = new Map<string, number>();
  for (const row of (data as { series_id: string | null }[] | null) ?? []) {
    if (row.series_id) counts.set(row.series_id, (counts.get(row.series_id) ?? 0) + 1);
  }
  return counts;
}

export async function listEventsAdmin(): Promise<EventRecord[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false });
  return (data as EventRecord[] | null) ?? [];
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  const supabase = await client();
  const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  return (data as EventRecord | null) ?? null;
}

export async function getEventBlocks(eventId: string): Promise<EventBlock[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('event_blocks')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order');
  return (data as EventBlock[] | null) ?? [];
}

export async function listActivitiesAdmin(): Promise<Activity[]> {
  const supabase = await client();
  const { data } = await supabase.from('activities').select('*').order('sort_order');
  return (data as Activity[] | null) ?? [];
}

export async function getActivity(id: string): Promise<Activity | null> {
  const supabase = await client();
  const { data } = await supabase.from('activities').select('*').eq('id', id).maybeSingle();
  return (data as Activity | null) ?? null;
}

export async function listPagesAdmin(): Promise<ContentPage[]> {
  const supabase = await client();
  const { data } = await supabase.from('pages').select('*').order('slug');
  return (data as ContentPage[] | null) ?? [];
}

export async function getPage(id: string): Promise<ContentPage | null> {
  const supabase = await client();
  const { data } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
  return (data as ContentPage | null) ?? null;
}

export async function getSettings(): Promise<SiteSettings | null> {
  const supabase = await client();
  const { data } = await supabase.from('site_settings').select('*').eq('id', 1).maybeSingle();
  return (data as SiteSettings | null) ?? null;
}

export async function listProfiles(): Promise<(Profile & { email?: string })[]> {
  const supabase = await client();
  const { data } = await supabase.from('profiles').select('*').order('created_at');
  return (data as Profile[] | null) ?? [];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  attachments: ContactAttachment[];
  topic_id: string | null;
  topic: { name_he: string; name_en: string | null } | null;
  /** מפתח = contact_fields.id, ערך = תשובת הפונה. */
  custom_field_values: Record<string, string | boolean>;
  is_handled: boolean;
  created_at: string;
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('contact_messages')
    .select('*, topic:contact_topics ( name_he, name_en )')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as ContactMessage[] | null) ?? [];
}

export async function listContactTopics(): Promise<ContactTopic[]> {
  const supabase = await client();
  const { data } = await supabase.from('contact_topics').select('*').order('sort_order');
  return (data as ContactTopic[] | null) ?? [];
}

export async function getContactTopic(id: string): Promise<ContactTopic | null> {
  const supabase = await client();
  const { data } = await supabase.from('contact_topics').select('*').eq('id', id).maybeSingle();
  return (data as ContactTopic | null) ?? null;
}

export async function listContactFields(): Promise<ContactField[]> {
  const supabase = await client();
  const { data } = await supabase.from('contact_fields').select('*').order('sort_order');
  return (data as ContactField[] | null) ?? [];
}

export async function getContactField(id: string): Promise<ContactField | null> {
  const supabase = await client();
  const { data } = await supabase.from('contact_fields').select('*').eq('id', id).maybeSingle();
  return (data as ContactField | null) ?? null;
}

/**
 * קישורים חתומים לקבצים המצורפים לפניות — ה-bucket פרטי (ראו
 * 20_contact_attachments.sql), ולכן אין להם כתובת ציבורית קבועה.
 * נוצרים לפי דרישה עם תוקף קצר, לא נשמרים. הקריאה משתמשת ב-session
 * של הצוות (client() למעלה, לא service role) כך שמדיניות ה-RLS
 * (רק can_edit()) נאכפת גם כאן.
 */
export async function getContactAttachmentUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const supabase = await client();
  const { data, error } = await supabase.storage.from('contact-attachments').createSignedUrls(paths, 600);
  if (error || !data) {
    console.error('[admin:contactAttachments]', error?.message);
    return {};
  }

  const urls: Record<string, string> = {};
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
  }
  return urls;
}

/** ספירות לדשבורד. */
export async function getDashboardCounts() {
  const supabase = await client();

  const countRows = async (table: string, column?: string, value?: unknown) => {
    const query = supabase.from(table).select('id', { count: 'exact', head: true });
    const { count } = column ? await query.eq(column, value) : await query;
    return count ?? 0;
  };

  const [books, drafts, authors, events, messages] = await Promise.all([
    countRows('books'),
    countRows('books', 'is_published', false),
    countRows('authors'),
    countRows('events'),
    countRows('contact_messages', 'is_handled', false),
  ]);

  return { books, drafts, authors, events, messages };
}

export async function listBanners(): Promise<Banner[]> {
  const supabase = await client();
  const { data } = await supabase.from('banners').select('*').order('sort_order');
  return (data as Banner[] | null) ?? [];
}

export async function getBanner(id: string): Promise<Banner | null> {
  const supabase = await client();
  const { data } = await supabase.from('banners').select('*').eq('id', id).maybeSingle();
  return (data as Banner | null) ?? null;
}
