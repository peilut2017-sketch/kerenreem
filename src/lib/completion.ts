import type { Book, BookRelations } from './supabase/types';

/**
 * מד השלמה לספר.
 *
 * לא בודק "האם מותר לפרסם" — is_published היא החלטה מכוונת של העורך,
 * לא ליקוי איכות. הבדיקה כאן היא "האם מיצינו את המידע שאפשר למלא",
 * בלי קשר אם הספר כבר מפורסם או עדיין טיוטה. כך עורך יכול לראות בדיוק
 * מה חסר לפני שהוא לוחץ פרסום, ולא רק אחרי.
 *
 * [1.10] כל שדה מקבל ניקוד (weight) לפי ערכו למבקר בעמוד הספר, לא
 * משקל שווה לכולם: שם הספר, תיאור וכריכה — הדברים הראשונים שמבקר רואה
 * וש-SEO/שיתוף נשענים עליהם — מקבלים ניקוד גבוה; שדות שהם "נחמד שיהיה"
 * (מפרט מהדורה, ציטוטים) מקבלים ניקוד בינוני; ושדות האנגלית, שרלוונטיים
 * רק לחלק מהמבקרים (האתר דו-לשוני אך עברית היא ברירת המחדל), מקבלים כ-
 * שליש מהניקוד של המקבילה העברית שלהם. האחוז הכולל הוא סכום הניקוד
 * שהושג חלקי סכום הניקוד האפשרי — לא ספירת שדות פשוטה.
 */

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
  /** ניקוד השדה — ערכו היחסי מתוך כלל הניקוד האפשרי, ראו הסבר למעלה. */
  weight: number;
}

export interface Completion {
  percent: number;
  items: CompletionItem[];
  /** ממוין מהניקוד הגבוה לנמוך — מה שהכי משתלם להשלים קודם. */
  missing: CompletionItem[];
}

export function computeCompletion(book: Book, relations: BookRelations): Completion {
  const items: CompletionItem[] = [
    { key: 'title', label: 'שם הספר', done: Boolean(book.title_he), weight: 10 },
    { key: 'cover', label: 'כריכה', done: Boolean(book.cover_image_url), weight: 10 },
    { key: 'description', label: 'תיאור', done: Boolean(book.description_he), weight: 10 },
    { key: 'author', label: 'מחבר', done: Boolean(book.author_id) || Boolean(book.author_name_he), weight: 7 },
    { key: 'subtitle', label: 'כותרת משנה', done: Boolean(book.subtitle_he), weight: 6 },
    { key: 'category', label: 'קטגוריה', done: Boolean(book.category_id), weight: 6 },
    {
      key: 'seo',
      label: 'תיאור לתוצאות חיפוש (SEO)',
      done: Boolean(book.meta_description || book.meta_title),
      weight: 5,
    },
    { key: 'description_brief', label: 'תמצית קצרה', done: Boolean(book.description_brief_he), weight: 4 },
    { key: 'tags', label: 'תגיות', done: relations.tagIds.length > 0, weight: 4 },
    { key: 'sample', label: 'דפדוף לדוגמה (PDF)', done: Boolean(book.sample_pdf_url), weight: 4 },
    {
      key: 'cover_alt',
      label: 'טקסט חלופי לכריכה',
      // בלי כריכה אין מה לתאר — זה לא ליקוי במקרה הזה, ולכן נחשב מולא
      done: !book.cover_image_url || Boolean(book.cover_alt),
      weight: 2,
    },
    { key: 'publication_year', label: 'שנת הוצאה', done: Boolean(book.publication_year_he || book.publication_year_ce), weight: 3 },
    { key: 'publisher', label: 'הוצאה לאור', done: Boolean(book.publisher_he), weight: 2 },
    { key: 'isbn', label: 'מסת״ב', done: Boolean(book.isbn), weight: 2 },
    { key: 'pages', label: 'מספר עמודים', done: book.pages != null, weight: 2 },
    // ‎?? []‎: שורה גולמית מהניהול (listBooks) יכולה להגיע עם quotes=null
    // במסד שטרם הריץ את 10_book_page_stage_c — גישה ישירה הפילה את המסך.
    { key: 'quotes', label: 'ציטוטים', done: (book.quotes ?? []).length > 0, weight: 2 },
    // שדות אנגלית — כשליש מהניקוד של המקבילה העברית, ראו הסבר למעלה
    { key: 'title_en', label: 'שם (אנגלית)', done: Boolean(book.title_en), weight: 3 },
    { key: 'description_en', label: 'תיאור (אנגלית)', done: Boolean(book.description_en), weight: 3 },
    { key: 'subtitle_en', label: 'כותרת משנה (אנגלית)', done: Boolean(book.subtitle_en), weight: 2 },
  ];

  // פריטי מסחר נבדקים רק לספר שסומן לרכישה — ספר קטלוג אינו "חסר" מחיר.
  if (book.is_purchasable) {
    items.push(
      { key: 'price', label: 'מחיר', done: book.price != null, weight: 6 },
      { key: 'weight', label: 'משקל למשלוח', done: book.weight_grams != null, weight: 3 },
      {
        key: 'stock',
        label: 'מלאי',
        done: !book.is_stock_managed || book.preorder_enabled || (book.stock_quantity ?? 0) > 0,
        weight: 3,
      },
    );
  }

  const missing = items.filter((item) => !item.done).sort((a, b) => b.weight - a.weight);
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const earnedWeight = items.reduce((sum, item) => sum + (item.done ? item.weight : 0), 0);
  const percent = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 100;

  return { percent, items, missing };
}
