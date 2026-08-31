'use server';

import { getAuthors, getBooks, getCategories, getSiteSettings } from './data';
import { getBookAvailability } from './books/availability';
import { getEffectivePrice, formatPrice } from './commerce/pricing';
import { normalise, matches, searchCorpus } from './book-search';
import { localized } from './localized';
import type { BookAvailability } from './supabase/types';

/**
 * [1.4] חיפוש גלובלי אמיתי (ב.2 בביקורת המימוש): לפני התיקון ה-submit
 * בכותרת רק ניווט ל-/books?q=… בלי שום תוצאה חיה. פועל בדיוק כמו
 * book-search.ts — קטלוג שלם בזיכרון בצד השרת, לא Postgres full-text
 * (אותו נימוק: מאות כותרים, לא אלפים). אם הקטלוג יגדל משמעותית, זה
 * המקום להחליף לחיפוש מבוסס-מסד.
 */

export interface GlobalSearchBook {
  slug: string;
  title: string;
  author: string | null;
  cover: string | null;
  price: string | null;
  availability: BookAvailability;
}

export interface GlobalSearchEntity {
  slug: string;
  name: string;
}

export interface GlobalSearchResult {
  books: GlobalSearchBook[];
  totalBooks: number;
  authors: GlobalSearchEntity[];
  categories: GlobalSearchEntity[];
}

const EMPTY_RESULT: GlobalSearchResult = { books: [], totalBooks: 0, authors: [], categories: [] };

/**
 * מטמון קצר ברמת התהליך לנתוני החיפוש + המאגרים המחושבים.
 *
 * Server Actions אינם עוברים ISR — כל הקשה ששרדה את ה-debounce משכה את
 * הקטלוג המלא (כל ה-joins) ובנתה מחדש את מאגרי הטקסט של כל הספרים.
 * דקה של מטמון תואמת את חלון ה-revalidate של שאר האתר, ועל instance חם
 * הופכת את רוב החיפושים לעבודת זיכרון בלבד.
 */
interface SearchDataset {
  books: Awaited<ReturnType<typeof getBooks>>;
  corpora: Map<string, string>;
  authors: Awaited<ReturnType<typeof getAuthors>>;
  categories: Awaited<ReturnType<typeof getCategories>>;
  storeEnabled: boolean;
}
let searchCache: { at: number; dataset: SearchDataset } | null = null;
const SEARCH_CACHE_MS = 60_000;

async function loadSearchDataset(): Promise<SearchDataset> {
  const now = Date.now();
  if (searchCache && now - searchCache.at < SEARCH_CACHE_MS) return searchCache.dataset;

  const [books, authors, categories, settings] = await Promise.all([
    getBooks(),
    getAuthors(),
    getCategories(),
    getSiteSettings(),
  ]);
  const dataset: SearchDataset = {
    books,
    corpora: new Map(books.map((book) => [book.id, searchCorpus(book)])),
    authors,
    categories,
    storeEnabled: settings.store_enabled,
  };
  searchCache = { at: now, dataset };
  return dataset;
}

export async function globalSearch(query: string, locale: string): Promise<GlobalSearchResult> {
  const q = query.trim().slice(0, 100);
  if (!q) return EMPTY_RESULT;

  const { books, corpora, authors, categories, storeEnabled } = await loadSearchDataset();

  const matchedBooks = books.filter((book) => matches(corpora.get(book.id) ?? '', q));
  const matchedAuthors = authors
    .filter((author) => matches(normalise(localized(author, 'name', locale)), q))
    .slice(0, 4);
  const matchedCategories = categories
    .filter((category) => matches(normalise(localized(category, 'name', locale)), q))
    .slice(0, 4);

  return {
    books: matchedBooks.slice(0, 6).map((book) => {
      const price = storeEnabled ? getEffectivePrice(book, locale) : null;
      return {
        slug: book.slug,
        title: localized(book, 'title', locale),
        author: book.author ? localized(book.author, 'name', locale) : (book.author_name_he ?? null),
        cover: book.cover_image_url,
        price: price ? formatPrice(price.amount, locale) : null,
        availability: getBookAvailability(book, storeEnabled),
      };
    }),
    totalBooks: matchedBooks.length,
    authors: matchedAuthors.map((author) => ({ slug: author.slug, name: localized(author, 'name', locale) })),
    categories: matchedCategories.map((category) => ({
      slug: category.slug,
      name: localized(category, 'name', locale),
    })),
  };
}
