import type { Book, BookAvailability } from '@/lib/supabase/types';

/**
 * מצב הזמינות הציבורי של ספר — לעולם לא כמות מספרית (סעיף 11 במפרט).
 *
 * ממופה לפי סדר קבוע: קטלוג בלבד (אין חנות/לא ניתן לרכישה/אין מחיר) →
 * הזמנה מראש (אם הוגדרה) → במלאי → אזל זמנית. פונקציה טהורה אחת ולא
 * חישוב שחוזר על עצמו בכל רכיב שמציג מחיר או כפתור קנייה.
 */
export function getBookAvailability(
  book: Pick<Book, 'is_purchasable' | 'price' | 'stock_quantity' | 'preorder_enabled'>,
  storeEnabled: boolean,
): BookAvailability {
  if (!storeEnabled || !book.is_purchasable || book.price == null) return 'catalog_only';
  if (book.preorder_enabled) return 'preorder';
  return (book.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
}
