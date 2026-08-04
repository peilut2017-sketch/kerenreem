import type { Book, BookRelations } from './supabase/types';

/**
 * מד השלמה לספר.
 *
 * לא בודק "האם מותר לפרסם" — is_published היא החלטה מכוונת של העורך,
 * לא ליקוי איכות. הבדיקה כאן היא "האם מיצינו את המידע שאפשר למלא",
 * בלי קשר אם הספר כבר מפורסם או עדיין טיוטה. כך עורך יכול לראות בדיוק
 * מה חסר לפני שהוא לוחץ פרסום, ולא רק אחרי.
 *
 * המשקלים שווים במכוון: אין דרך אובייקטיבית לקבוע ששדה אחד "חשוב" משדה
 * אחר עבור כל ספר, ומשקל לא-שווה היה דורש הצדקה שאין לה מקור.
 */

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
}

export interface Completion {
  percent: number;
  items: CompletionItem[];
  missing: CompletionItem[];
}

export function computeCompletion(book: Book, relations: BookRelations): Completion {
  const items: CompletionItem[] = [
    { key: 'cover', label: 'כריכה', done: Boolean(book.cover_image_url) },
    {
      key: 'cover_alt',
      label: 'טקסט חלופי לכריכה',
      // בלי כריכה אין מה לתאר — זה לא ליקוי במקרה הזה, ולכן נחשב מולא
      done: !book.cover_image_url || Boolean(book.cover_alt),
    },
    { key: 'author', label: 'מחבר', done: Boolean(book.author_id) || Boolean(book.author_name_he) },
    { key: 'category', label: 'קטגוריה', done: Boolean(book.category_id) },
    { key: 'description', label: 'תיאור', done: Boolean(book.description_he) },
    {
      key: 'seo',
      label: 'תיאור לתוצאות חיפוש (SEO)',
      done: Boolean(book.meta_description || book.meta_title),
    },
    { key: 'tags', label: 'תגיות', done: relations.tagIds.length > 0 },
    { key: 'sample', label: 'דפדוף לדוגמה (PDF)', done: Boolean(book.sample_pdf_url) },
  ];

  const missing = items.filter((item) => !item.done);
  const percent = Math.round(((items.length - missing.length) / items.length) * 100);

  return { percent, items, missing };
}
