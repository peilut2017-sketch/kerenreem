'use server';

import {
  getActivities,
  getAuthors,
  getBooks,
  getCategories,
  getContentPages,
  getEvents,
  getSiteSettings,
} from './data';
import { getBookAvailability } from './books/availability';
import { getEffectivePrice, formatPrice } from './commerce/pricing';
import { normalise, matches, searchCorpus } from './book-search';
import { localized } from './localized';
import { getTranslations } from 'next-intl/server';
import type { BookAvailability } from './supabase/types';

/**
 * [1.4] חיפוש גלובלי אמיתי (ב.2 בביקורת המימוש): לפני התיקון ה-submit
 * בכותרת רק ניווט ל-/books?q=… בלי שום תוצאה חיה. פועל בדיוק כמו
 * book-search.ts — קטלוג שלם בזיכרון בצד השרת, לא Postgres full-text
 * (אותו נימוק: מאות כותרים, לא אלפים). אם הקטלוג יגדל משמעותית, זה
 * המקום להחליף לחיפוש מבוסס-מסד.
 *
 * ‏[1.41] החיפוש חורג מהקטלוג. עד כה הוא ידע ספרים, מחברים וקטגוריות
 * בלבד — מי שחיפש "אירועים" או את שם אירוע מסוים לא קיבל דבר, אף
 * שהעמודים קיימים באתר. נוספו:
 *
 *   • **אירועים** ו**פעילות** — לפי כותרת וגוף הטקסט.
 *   • **עמודי תוכן** — אודות וכל עמוד שנערך בניהול, לפי כותרת וגוף.
 *   • **מקטעי האתר** — כך שהקלדת "אירועים" מציעה את עמוד האירועים
 *     עצמו, ולא רק אירוע שבמקרה נושא את המילה בכותרתו.
 *
 * עמודים טכניים ומשפטיים אינם נכללים: הצהרת נגישות, מדיניות פרטיות
 * ותקנון. הם מגיעים מהכותרת התחתונה ומהצהרות חוק, ולא ממה שמבקר מחפש;
 * שלושתם היו מציפים כל שאילתה שמכילה מילה נפוצה. ראו EXCLUDED_PAGES —
 * זו הרשימה היחידה שצריך לשנות כדי לכלול אותם.
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

/** תוצאה שאינה ישות בקטלוג: אירוע, פעילות, עמוד תוכן או מקטע באתר. */
export interface GlobalSearchPage {
  href: string;
  title: string;
  /** שורת הקשר קצרה — תקציר האירוע/העמוד, או תיאור המקטע. */
  excerpt: string | null;
}

export interface GlobalSearchResult {
  books: GlobalSearchBook[];
  totalBooks: number;
  authors: GlobalSearchEntity[];
  categories: GlobalSearchEntity[];
  events: GlobalSearchPage[];
  activities: GlobalSearchPage[];
  pages: GlobalSearchPage[];
}

const EMPTY_RESULT: GlobalSearchResult = {
  books: [],
  totalBooks: 0,
  authors: [],
  categories: [],
  events: [],
  activities: [],
  pages: [],
};

/**
 * עמודי תוכן שאינם נכללים בחיפוש — טכניים ומשפטיים. ראו התיעוד למעלה.
 * זו הרשימה היחידה שיש לשנות כדי לכלול אותם.
 */
const EXCLUDED_PAGES = new Set(['accessibility', 'privacy', 'terms']);

/**
 * מקטעי האתר עצמם, כדי ש"אירועים" יציע את עמוד האירועים ולא רק אירוע
 * שבמקרה נושא את המילה. המילים הנוספות (aliases) הן מה שמבקר מקליד
 * בפועל ולא בהכרח שם המקטע — "חנות" לקטלוג, "מייל" ליצירת קשר.
 */
const SECTIONS: { href: string; key: string; aliases: string[] }[] = [
  { href: '/books', key: 'books', aliases: ['קטלוג', 'חנות', 'ספר', 'catalogue', 'shop'] },
  { href: '/authors', key: 'authors', aliases: ['מחבר', 'רב', 'authors'] },
  { href: '/events', key: 'events', aliases: ['אירוע', 'כינוס', 'events'] },
  { href: '/activities', key: 'activities', aliases: ['פעילות', 'צירי פעילות', 'activities'] },
  { href: '/about', key: 'about', aliases: ['על המכון', 'המכון', 'about'] },
  { href: '/contact', key: 'contact', aliases: ['יצירת קשר', 'מייל', 'טלפון', 'כתובת', 'contact'] },
];

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
  events: Awaited<ReturnType<typeof getEvents>>;
  activities: Awaited<ReturnType<typeof getActivities>>;
  pages: Awaited<ReturnType<typeof getContentPages>>;
  storeEnabled: boolean;
}
let searchCache: { at: number; dataset: SearchDataset } | null = null;
const SEARCH_CACHE_MS = 60_000;

async function loadSearchDataset(): Promise<SearchDataset> {
  const now = Date.now();
  if (searchCache && now - searchCache.at < SEARCH_CACHE_MS) return searchCache.dataset;

  const [books, authors, categories, events, activities, pages, settings] = await Promise.all([
    getBooks(),
    getAuthors(),
    getCategories(),
    getEvents(),
    getActivities(),
    getContentPages(),
    getSiteSettings(),
  ]);
  const dataset: SearchDataset = {
    books,
    corpora: new Map(books.map((book) => [book.id, searchCorpus(book)])),
    authors,
    categories,
    events,
    activities,
    pages: pages.filter((page) => !EXCLUDED_PAGES.has(page.slug)),
    storeEnabled: settings.store_enabled,
  };
  searchCache = { at: now, dataset };
  return dataset;
}

/** הסרת תגיות לצורך חיפוש בגוף טקסט שנערך בעורך העשיר. */
function plain(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * שורת ההקשר שמוצגת מתחת לכותרת: המשפט הראשון בגוף הטקסט.
 * לא קטע סביב ההתאמה — עמוד תוכן אינו מסמך שמחפשים בו מופע, אלא יעד;
 * המשפט הפותח אומר למבקר מה יש שם.
 */
function excerpt(html: string | null | undefined, limit = 90): string | null {
  const text = plain(html).replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}

export async function globalSearch(query: string, locale: string): Promise<GlobalSearchResult> {
  const q = query.trim().slice(0, 100);
  if (!q) return EMPTY_RESULT;

  const { books, corpora, authors, categories, events, activities, pages, storeEnabled } =
    await loadSearchDataset();

  const matchedBooks = books.filter((book) => matches(corpora.get(book.id) ?? '', q));
  const matchedAuthors = authors
    .filter((author) => matches(normalise(localized(author, 'name', locale)), q))
    .slice(0, 4);
  const matchedCategories = categories
    .filter((category) => matches(normalise(localized(category, 'name', locale)), q))
    .slice(0, 4);

  /*
   * אירועים ופעילות: כותרת וגוף. האירועים מגיעים מ-getEvents מסודרים
   * לפי תאריך יורד, ולכן ההגבלה ל-4 משאירה את העדכניים.
   */
  const matchedEvents = events
    .filter((event) =>
      matches(normalise([localized(event, 'title', locale), plain(localized(event, 'body', locale))].join(' ')), q),
    )
    .slice(0, 4)
    .map((event) => ({
      href: `/events/${event.slug}`,
      title: localized(event, 'title', locale),
      excerpt: event.event_date_he ?? excerpt(localized(event, 'body', locale)),
    }));

  const matchedActivities = activities
    .filter((activity) =>
      matches(
        normalise(
          [
            localized(activity, 'title', locale),
            localized(activity, 'summary', locale),
            plain(localized(activity, 'body', locale)),
          ].join(' '),
        ),
        q,
      ),
    )
    .slice(0, 4)
    .map((activity) => ({
      href: `/activities/${activity.slug}`,
      title: localized(activity, 'title', locale),
      excerpt: localized(activity, 'summary', locale) || excerpt(localized(activity, 'body', locale)),
    }));

  /*
   * מקטעי האתר ועמודי התוכן מוצגים יחד תחת קבוצה אחת ("עמודים"):
   * מבחינת המבקר אין הבדל בין "עמוד האירועים" לבין "אודות", ושתי
   * קבוצות נפרדות של שורה אחת כל אחת הן רעש.
   *
   * המקטעים קודם, כי הם היעד הסביר יותר: מי שמקליד "אירועים" מתכוון
   * לרוב לעמוד ולא לעמוד תוכן שמזכיר את המילה.
   */
  const sectionLabels = await getTranslations({ locale, namespace: 'nav' });
  const matchedSections = SECTIONS.filter((section) => {
    const label = sectionLabels(section.key as 'books');
    return matches(normalise([label, ...section.aliases].join(' ')), q);
  }).map((section) => ({
    href: section.href,
    title: sectionLabels(section.key as 'books'),
    excerpt: null,
  }));

  const sectionHrefs = new Set(matchedSections.map((section) => section.href));
  const matchedPages = pages
    .filter((page) =>
      matches(normalise([localized(page, 'title', locale), plain(localized(page, 'body', locale))].join(' ')), q),
    )
    // עמוד תוכן ששמו זהה למקטע (למשל about) לא יוצג פעמיים.
    .filter((page) => !sectionHrefs.has(`/${page.slug}`))
    .slice(0, 4)
    .map((page) => ({
      href: `/${page.slug}`,
      title: localized(page, 'title', locale),
      excerpt: excerpt(localized(page, 'body', locale)),
    }));

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
    events: matchedEvents,
    activities: matchedActivities,
    pages: [...matchedSections, ...matchedPages],
  };
}
