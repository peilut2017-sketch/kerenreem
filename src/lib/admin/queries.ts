import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  Activity,
  Author,
  Book,
  Category,
  ContentPage,
  EventRecord,
  Profile,
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

export async function listBooks(): Promise<(Book & { author: Pick<Author, 'name_he'> | null })[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('books')
    .select('*, author:authors ( name_he )')
    .order('updated_at', { ascending: false });
  return (data as (Book & { author: Pick<Author, 'name_he'> | null })[] | null) ?? [];
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

export async function listCategoriesAdmin(): Promise<Category[]> {
  const supabase = await client();
  const { data } = await supabase.from('categories').select('*').order('sort_order');
  return (data as Category[] | null) ?? [];
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
  is_handled: boolean;
  created_at: string;
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  const supabase = await client();
  const { data } = await supabase
    .from('contact_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return (data as ContactMessage[] | null) ?? [];
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
