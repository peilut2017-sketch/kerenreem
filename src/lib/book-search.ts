import type { BookWithRelations } from './supabase/types';

/**
 * חיפוש, סינון ומיון בקטלוג.
 *
 * הכל רץ בצד הלקוח על הרשימה שהגיעה מהשרת: קטלוג של מאות כותרים אינו
 * מצדיק הלוך-ושוב לשרת על כל הקשה, והרינדור הראשוני נשאר מלא לטובת SEO.
 * אם הקטלוג יגדל לאלפי כותרים יהיה נכון להעביר את זה ל-Postgres full-text.
 */

/**
 * נרמול טקסט עברי לחיפוש.
 *
 * שלוש בעיות אמיתיות בקטלוג תורני, שחיפוש תמים נכשל בכולן:
 *
 * 1. ניקוד — "שַׁבָּת" ו"שבת" הן אותה מילה. הניקוד וטעמי המקרא מוסרים.
 * 2. גרשיים — שו״ת נכתב גם "שו"ת (גרשיים עבריות U+05F4) וגם שו"ת (מרכאה
 *    כפולה רגילה). המקלדת מייצרת אחד, הטקסט שהוקלד במסד לעתים את השני.
 *    שניהם מנורמלים לאותו תו, וכך גם הגרש הבודד ברא״ם ובר׳.
 * 3. מקף ורווח כפול — "בן-איש" מול "בן איש".
 */
export function normalise(value: string): string {
  return value
    .normalize('NFKD')
    // ניקוד, דגשים וטעמי מקרא
    .replace(/[֑-ׇ]/g, '')
    // גרשיים על כל צורותיהן
    .replace(/[״“”"]/g, '"')
    // גרש בודד על כל צורותיו
    .replace(/[׳‘’']/g, "'")
    .replace(/[-‐-―]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * הסרת תגיות לצורך חיפוש.
 *
 * לא משתמשים כאן ב-htmlToPlainText: הוא נועד לתצוגה ולכן חותך באורך מסוים
 * ומוסיף שלוש נקודות. בחיפוש חיתוך פירושו שמילה שמופיעה בסוף תיאור ארוך
 * פשוט לא תימצא, ושלוש הנקודות היו נכנסות למאגר כטקסט.
 */
function stripTags(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** כל הטקסט שספר ניתן להימצא לפיו. */
export function searchCorpus(book: BookWithRelations): string {
  return normalise(
    [
      book.title_he,
      book.title_en,
      book.subtitle_he,
      book.subtitle_en,
      book.author?.name_he,
      book.author?.name_en,
      book.category?.name_he,
      book.category?.name_en,
      // התיאור הוא HTML מהעורך; בלי הסרת התגיות חיפוש "עמוד" היה מוצא
      // כל ספר שיש בו <p>
      stripTags(book.description_he),
      stripTags(book.description_en),
      book.isbn,
      book.sku,
      book.publication_year_he,
      book.publication_year_ce?.toString(),
      book.format,
      book.binding,
      // תגיות ומאפיינים הם בדיוק מה שאדם מקליד: "שבת", "כריכה קשה"
      book.tags?.map((tag) => tag.name_he).join(' '),
      book.attributeValues?.map((value) => value.name_he).join(' '),
      book.search_keywords,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

/**
 * התאמה לפי כל המילים, בכל סדר.
 *
 * "רא"ם שו"ת" ימצא את "שו״ת רא״ם". חיפוש כמחרוזת אחת היה מחייב את
 * המשתמש לנחש את סדר המילים בכותר.
 */
export function matches(corpus: string, query: string): boolean {
  const terms = normalise(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  return terms.every((term) => corpus.includes(term));
}

export type SortKey = 'recommended' | 'newest' | 'oldest' | 'title' | 'priceAsc' | 'priceDesc';

export interface Filters {
  query: string;
  category: string;
  authors: string[];
  bindings: string[];
  tags: string[];
  attributeValues: string[];
  languages: string[];
  yearFrom: number | null;
  yearTo: number | null;
  multiVolume: boolean;
  withSample: boolean;
  purchasableOnly: boolean;
  favouritesOnly: boolean;
  priceMax: number | null;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  category: '',
  authors: [],
  bindings: [],
  tags: [],
  attributeValues: [],
  languages: [],
  yearFrom: null,
  yearTo: null,
  multiVolume: false,
  withSample: false,
  purchasableOnly: false,
  favouritesOnly: false,
  priceMax: null,
};

export function countActiveFilters(filters: Filters): number {
  return (
    filters.authors.length +
    filters.bindings.length +
    filters.tags.length +
    filters.attributeValues.length +
    filters.languages.length +
    (filters.yearFrom !== null || filters.yearTo !== null ? 1 : 0) +
    (filters.multiVolume ? 1 : 0) +
    (filters.withSample ? 1 : 0) +
    (filters.purchasableOnly ? 1 : 0) +
    (filters.favouritesOnly ? 1 : 0) +
    (filters.priceMax !== null ? 1 : 0)
  );
}

/** מדד למיון א׳-ת׳ שמכבד את סדר האלף-בית העברי. */
const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });

export function applyFilters(
  books: BookWithRelations[],
  filters: Filters,
  corpora: Map<string, string>,
  favourites: Set<string>,
  /** מזהה ערך → מזהה המאפיין שאליו הוא שייך */
  attributeOf: Map<string, string> = new Map(),
): BookWithRelations[] {
  return books.filter((book) => {
    if (filters.category && book.category?.slug !== filters.category) return false;
    if (filters.authors.length && !filters.authors.includes(book.author?.slug ?? '')) return false;
    if (filters.bindings.length && !filters.bindings.includes(book.binding ?? '')) return false;

    // כל תגית שנבחרה חייבת להימצא: בחירת "שבת" ו"הלכה" מבקשת ספרים
    // ששייכים לשניהם, לא לאחד מהם. איחוד היה מרחיב את התוצאה בכל לחיצה
    // נוספת, וזו התנהגות הפוכה למה שמצפים ממסנן.
    if (filters.tags.length) {
      const slugs = new Set((book.tags ?? []).map((tag) => tag.slug));
      if (!filters.tags.every((slug) => slugs.has(slug))) return false;
    }

    if (filters.attributeValues.length) {
      const ids = new Set((book.attributeValues ?? []).map((value) => value.id));
      // ערכים של אותו מאפיין הם איחוד ביניהם (כריכה קשה *או* רכה), ובין
      // מאפיינים שונים — חיתוך. אחרת בחירת שתי כריכות לא הייתה מחזירה דבר.
      const byAttribute = new Map<string, string[]>();
      for (const value of filters.attributeValues) {
        const attribute = attributeOf.get(value) ?? '';
        byAttribute.set(attribute, [...(byAttribute.get(attribute) ?? []), value]);
      }
      for (const group of byAttribute.values()) {
        if (!group.some((value) => ids.has(value))) return false;
      }
    }

    if (filters.languages.length) {
      const languages = book.languages ?? [];
      if (!filters.languages.some((code) => languages.includes(code))) return false;
    }
    if (filters.multiVolume && (book.volume_count ?? 1) < 2) return false;
    if (filters.withSample && !book.sample_pdf_url) return false;
    if (filters.purchasableOnly && !book.is_purchasable) return false;
    if (filters.favouritesOnly && !favourites.has(book.id)) return false;

    if (filters.priceMax !== null && (book.price === null || Number(book.price) > filters.priceMax)) {
      return false;
    }

    const year = book.publication_year_ce;
    if (filters.yearFrom !== null && (year === null || year < filters.yearFrom)) return false;
    if (filters.yearTo !== null && (year === null || year > filters.yearTo)) return false;

    if (filters.query) return matches(corpora.get(book.id) ?? '', filters.query);
    return true;
  });
}

export function sortBooks(books: BookWithRelations[], key: SortKey): BookWithRelations[] {
  const sorted = [...books];

  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'oldest':
      return sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title':
      return sorted.sort((a, b) => collator.compare(a.title_he, b.title_he));
    case 'priceAsc':
      return sorted.sort((a, b) => priceOf(a) - priceOf(b));
    case 'priceDesc':
      return sorted.sort((a, b) => priceOf(b) - priceOf(a));
    default:
      // סדר התצוגה שנקבע בניהול, ואז לפי שם — כדי שספרים בעלי אותו
      // sort_order לא יקפצו בין טעינות
      return sorted.sort(
        (a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0) || collator.compare(a.title_he, b.title_he),
      );
  }
}

/** ספר בלי מחיר יורד לסוף בשני כיווני המיון, ולא מתחזה לחינם. */
function priceOf(book: BookWithRelations): number {
  return book.price === null || book.price === undefined
    ? Number.POSITIVE_INFINITY
    : Number(book.price);
}
