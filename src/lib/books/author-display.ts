import { localized, localizedOrNull } from '@/lib/localized';
import type { Author } from '@/lib/supabase/types';

export interface AuthorDisplay {
  name: string;
  /** יעד הקישור לעמוד המחבר, או null כשאין לקשר (טקסט חופשי). */
  href: string | null;
}

type BookAuthorFields = {
  author_name_he?: string | null;
  author_name_en?: string | null;
  author?: Pick<Author, 'slug' | 'name_he' | 'name_en'> | null;
};

/**
 * שם המחבר להצגה, וקישור לעמודו — או null כשאין מחבר בכלל.
 *
 * טקסט מחבר חופשי (author_name_he/en) גובר תמיד על השיוך לרשומת מחבר:
 * הוא קיים בדיוק בשביל המקרה שבו לא רוצים קישור לעמוד מחבר קיים, ולכן
 * גם לא מקבל href. אם שני השדות מלאים (גם טקסט חופשי וגם author_id),
 * הטקסט החופשי הוא זה שמוצג.
 */
export function resolveBookAuthor(book: BookAuthorFields, locale: string): AuthorDisplay | null {
  const freeText = localizedOrNull(
    { author_name_he: book.author_name_he, author_name_en: book.author_name_en },
    'author_name',
    locale,
  );
  if (freeText) return { name: freeText, href: null };

  if (!book.author) return null;
  return { name: localized(book.author, 'name', locale), href: `/authors/${book.author.slug}` };
}
