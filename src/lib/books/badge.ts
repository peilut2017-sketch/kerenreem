import { localized } from '@/lib/localized';
import type { BookWithRelations } from '@/lib/supabase/types';

export interface BookBadge {
  label: string;
  /** 'accent' לבחירת המכון (זהב), 'neutral' לתגית רגילה. */
  tone: 'accent' | 'neutral';
}

/**
 * תגית "יושבת על הספר" בתצוגות קטלוג (כרטיס/שורה) — לכל היותר אחת, כדי
 * שהכרטיס יישאר נקי (הזהב הוא קו, לא שטח — ראו globals.css). בחירת המכון
 * קודמת לתגית רגילה: היא כוונה מפורשת של הצוות על ספר ספציפי, לא רק
 * סיווג; התגית הראשונה (חדש/רב מכר/וכו') היא הבאה בעדיפות.
 */
export function resolveBookBadge(
  book: Pick<BookWithRelations, 'is_featured' | 'tags'>,
  locale: string,
  featuredLabel: string,
): BookBadge | null {
  if (book.is_featured) return { label: featuredLabel, tone: 'accent' };
  if (book.tags && book.tags.length > 0) {
    return { label: localized(book.tags[0], 'name', locale), tone: 'neutral' };
  }
  return null;
}
