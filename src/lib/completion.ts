import type { Book, BookRelations } from './supabase/types';

/**
 * מד השלמה לספר.
 *
 * לא בודק "האם מותר לפרסם" — is_published היא החלטה מכוונת של העורך,
 * לא ליקוי איכות. הבדיקה כאן היא "האם מיצינו את המידע שאפשר למלא",
 * בלי קשר אם הספר כבר מפורסם או עדיין טיוטה. כך עורך יכול לראות בדיוק
 * מה חסר לפני שהוא לוחץ פרסום, ולא רק אחרי.
 *
 * [1.11] המד מכסה את *כל* השדות בכרטיס הספר, מכל הלשוניות — לא רק
 * פרטי יסוד ואנגלית: גם תמונות (שדרה, גלריה, דפדוף), תוכן עניינים,
 * קטגוריות ותגיות, זיהוי וחיפוש, ומסחר (לספר שסומן לרכישה). כל שדה
 * מקבל ניקוד (weight) לפי ערכו למבקר בעמוד הספר, לא משקל שווה לכולם:
 * שם, תיאור וכריכה — הדברים הראשונים שמבקר רואה וש-SEO/שיתוף נשענים
 * עליהם — מקבלים ניקוד גבוה; שדות "נחמד שיהיה" (מפרט מהדורה, ציטוטים,
 * גוני אווירה) מקבלים ניקוד נמוך, עד חצאי נקודות; ושדות האנגלית,
 * שרלוונטיים רק לחלק מהמבקרים, מקבלים כשליש מהמקבילה העברית. שדות
 * שהיעדרם הוא בחירה לגיטימית (סדרה, מבצע, ספק חיצוני, canonical)
 * אינם נספרים כלל. האחוז הכולל הוא סכום הניקוד שהושג חלקי סכום
 * הניקוד האפשרי — לא ספירת שדות פשוטה.
 */

/** מזהי הלשוניות בטופס הספר — לקיבוץ "מה חסר" לפי לשונית. */
export type CompletionTab =
  | 'basics'
  | 'english'
  | 'images'
  | 'toc'
  | 'taxonomy'
  | 'identity'
  | 'store';

export const COMPLETION_TAB_LABELS: Record<CompletionTab, string> = {
  basics: 'פרטי יסוד',
  english: 'אנגלית',
  images: 'תמונות',
  toc: 'תוכן עניינים',
  taxonomy: 'קטגוריות ותגיות',
  identity: 'זיהוי וחיפוש',
  store: 'מסחר',
};

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
  /** ניקוד השדה — ערכו היחסי מתוך כלל הניקוד האפשרי. חצאי נקודות מותרים. */
  weight: number;
  /** באיזו לשונית בטופס הספר השדה נמצא. */
  tab: CompletionTab;
}

export interface Completion {
  percent: number;
  items: CompletionItem[];
  /** ממוין מהניקוד הגבוה לנמוך — מה שהכי משתלם להשלים קודם. */
  missing: CompletionItem[];
}

/**
 * אותות ההשלמה שמעבר לעמודות טבלת books עצמה: יחסים וטבלאות-בת.
 * תואם מבנית ל-BookRelations, בתוספת ספירות רשות מטבלאות הבת —
 * צרכן שאינו יודע אותן (ערך undefined) פשוט לא יזכה בנקודות עליהן,
 * ולכן כל המסכים חייבים לספק אותן כדי שהאחוז יהיה עקבי.
 */
export interface CompletionSignals extends BookRelations {
  /** מספר תמונות הגלריה (book_images). */
  galleryCount?: number;
  /** מספר שורות תוכן העניינים (book_toc). */
  tocCount?: number;
  /** מספר דפי הדפדוף (book_preview_pages). */
  previewCount?: number;
}

export function computeCompletion(book: Book, signals: CompletionSignals): Completion {
  const items: CompletionItem[] = [
    // ‑-- פרטי יסוד ---
    { key: 'title', label: 'שם הספר', done: Boolean(book.title_he), weight: 10, tab: 'basics' },
    { key: 'description', label: 'תיאור', done: Boolean(book.description_he), weight: 10, tab: 'basics' },
    { key: 'author', label: 'מחבר', done: Boolean(book.author_id) || Boolean(book.author_name_he), weight: 7, tab: 'basics' },
    { key: 'subtitle', label: 'כותרת משנה', done: Boolean(book.subtitle_he), weight: 5, tab: 'basics' },
    { key: 'description_brief', label: 'תמצית קצרה', done: Boolean(book.description_brief_he), weight: 4, tab: 'basics' },
    { key: 'publication_year', label: 'שנת הוצאה עברית', done: Boolean(book.publication_year_he), weight: 2, tab: 'basics' },
    { key: 'publication_year_ce', label: 'שנת הוצאה לועזית', done: book.publication_year_ce != null, weight: 1, tab: 'basics' },
    // [1.26] publisher/pages/isbn/sku/edition/binding עברו ל"מפרט הספר"
    // (taxonomy) יחד עם מקטע "מפרט המהדורה" — tab כאן הוא לצ'קליסט
    // ההשלמה, לא רק לניתוב שגיאות, ואמור להצביע לאן זה נמצא בפועל.
    { key: 'publisher', label: 'הוצאה לאור', done: Boolean(book.publisher_he), weight: 2, tab: 'taxonomy' },
    { key: 'pages', label: 'מספר עמודים', done: book.pages != null, weight: 2, tab: 'taxonomy' },
    { key: 'isbn', label: 'מסת״ב', done: Boolean(book.isbn), weight: 2, tab: 'taxonomy' },
    { key: 'quotes', label: 'ציטוטים', done: book.quotes.length > 0, weight: 2, tab: 'basics' },
    { key: 'sku', label: 'מק״ט', done: Boolean(book.sku), weight: 1.5, tab: 'taxonomy' },
    { key: 'edition', label: 'מהדורה', done: Boolean(book.edition_he), weight: 1, tab: 'taxonomy' },
    { key: 'binding', label: 'כריכה (סוג)', done: Boolean(book.binding), weight: 1, tab: 'taxonomy' },
    { key: 'accent_primary', label: 'גוון אווירה ראשי', done: Boolean(book.accent_primary), weight: 0.5, tab: 'basics' },
    { key: 'accent_secondary', label: 'גוון אווירה משני', done: Boolean(book.accent_secondary), weight: 0.5, tab: 'basics' },

    // --- אנגלית — כשליש מהניקוד של המקבילה העברית ---
    { key: 'title_en', label: 'שם (אנגלית)', done: Boolean(book.title_en), weight: 3, tab: 'english' },
    { key: 'description_en', label: 'תיאור (אנגלית)', done: Boolean(book.description_en), weight: 3, tab: 'english' },
    { key: 'subtitle_en', label: 'כותרת משנה (אנגלית)', done: Boolean(book.subtitle_en), weight: 1.5, tab: 'english' },
    { key: 'description_brief_en', label: 'תמצית קצרה (אנגלית)', done: Boolean(book.description_brief_en), weight: 1.5, tab: 'english' },
    { key: 'author_name_en', label: 'שם מחבר (אנגלית)', done: Boolean(book.author_name_en), weight: 1, tab: 'english' },
    { key: 'publisher_en', label: 'הוצאה לאור (אנגלית)', done: Boolean(book.publisher_en), weight: 0.5, tab: 'english' },
    { key: 'edition_en', label: 'מהדורה (אנגלית)', done: Boolean(book.edition_en), weight: 0.5, tab: 'english' },

    // --- תמונות ---
    { key: 'cover', label: 'כריכה', done: Boolean(book.cover_image_url), weight: 10, tab: 'images' },
    { key: 'sample', label: 'דפדוף לדוגמה (PDF)', done: Boolean(book.sample_pdf_url), weight: 3, tab: 'images' },
    { key: 'spine', label: 'תמונת שדרה', done: Boolean(book.spine_image_url), weight: 2, tab: 'images' },
    { key: 'gallery', label: 'גלריית תמונות', done: (signals.galleryCount ?? 0) > 0, weight: 2, tab: 'images' },
    { key: 'hero_mockup', label: 'הדמיית כריכה', done: Boolean(book.hero_mockup_url), weight: 1.5, tab: 'images' },
    { key: 'preview_pages', label: 'דפי דפדוף', done: (signals.previewCount ?? 0) > 0, weight: 1.5, tab: 'images' },

    // --- תוכן עניינים ---
    { key: 'toc', label: 'תוכן עניינים', done: (signals.tocCount ?? 0) > 0, weight: 3, tab: 'toc' },

    // --- קטגוריות ותגיות ---
    { key: 'tags', label: 'תגיות', done: signals.tagIds.length > 0, weight: 3, tab: 'taxonomy' },
    { key: 'attributes', label: 'מאפיינים', done: signals.attributeValueIds.length > 0, weight: 1.5, tab: 'taxonomy' },
    // [1.21] קטגוריה יחידה נבחרה בעבר בלשונית "פרטי יסוד"; עכשיו כל
    // הקטגוריות (כולל הראשית) נבחרות יחד כאן, ראו BookForm.tsx.
    { key: 'category', label: 'קטגוריות', done: signals.categoryIds.length > 0, weight: 5, tab: 'taxonomy' },
    { key: 'languages', label: 'שפות', done: book.languages.length > 0, weight: 1, tab: 'taxonomy' },

    // --- זיהוי וחיפוש ---
    { key: 'meta_description', label: 'תיאור לתוצאות חיפוש (SEO)', done: Boolean(book.meta_description), weight: 2.5, tab: 'identity' },
    {
      key: 'cover_alt',
      label: 'טקסט חלופי לכריכה',
      // בלי כריכה אין מה לתאר — זה לא ליקוי במקרה הזה, ולכן נחשב מולא
      done: !book.cover_image_url || Boolean(book.cover_alt),
      weight: 2,
      tab: 'identity',
    },
    { key: 'meta_title', label: 'כותרת לתוצאות חיפוש', done: Boolean(book.meta_title), weight: 1.5, tab: 'identity' },
    { key: 'search_keywords', label: 'מילות חיפוש', done: Boolean(book.search_keywords), weight: 1.5, tab: 'identity' },
  ];

  // פריטי מסחר נבדקים רק לספר שסומן לרכישה — ספר קטלוג אינו "חסר" מחיר.
  if (book.is_purchasable) {
    items.push(
      { key: 'price', label: 'מחיר', done: book.price != null, weight: 6, tab: 'store' },
      {
        key: 'stock',
        label: 'מלאי',
        done: !book.is_stock_managed || book.preorder_enabled || (book.stock_quantity ?? 0) > 0,
        weight: 3,
        tab: 'store',
      },
      { key: 'weight', label: 'משקל למשלוח', done: book.weight_grams != null, weight: 2, tab: 'store' },
      { key: 'physical_size', label: 'מידות פיזיות', done: Boolean(book.physical_size), weight: 1, tab: 'store' },
      { key: 'barcode', label: 'ברקוד', done: Boolean(book.barcode), weight: 1, tab: 'store' },
    );
  }

  const missing = items.filter((item) => !item.done).sort((a, b) => b.weight - a.weight);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const percent = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

  return { percent, items, missing };
}
