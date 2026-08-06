'use server';

import { getBooksByIds } from '@/lib/data';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * עמוד "הספרים שאהבתי" (פרק 5): הרשימה עצמה חיה במכשיר (kr:favourites,
 * ולחשבון מחובר — saved_books); הפעולה כאן רק מתרגמת מזהים לכרטיסים —
 * ספרים מפורסמים בלבד, נתונים ציבוריים בלבד. אין כאן שום כתיבה.
 */
export async function fetchFavouriteBooks(ids: string[]): Promise<BookWithRelations[]> {
  const cleaned = [...new Set(ids.filter((id) => typeof id === 'string' && id.length < 64))].slice(
    0,
    100,
  );
  if (cleaned.length === 0) return [];
  return getBooksByIds(cleaned);
}
