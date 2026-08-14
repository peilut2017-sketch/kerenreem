'use server';

import { getAuthors, getBooks, getCategories } from './data';
import { getCommerceFlags } from './commerce/settings';
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

export async function globalSearch(query: string, locale: string): Promise<GlobalSearchResult> {
  const q = query.trim();
  if (!q) return EMPTY_RESULT;

  const [books, authors, categories, flags] = await Promise.all([
    getBooks(),
    getAuthors(),
    getCategories(),
    getCommerceFlags(),
  ]);
  // showPrices ולא store_enabled הגולמי: כשהמחירים כבויים, גם דיאלוג
  // החיפוש לא מציג מחיר — כמו כל שאר משטחי התצוגה (קטלוג, עמוד ספר).
  const storeEnabled = flags.showPrices;

  const matchedBooks = books.filter((book) => matches(searchCorpus(book), q));
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
