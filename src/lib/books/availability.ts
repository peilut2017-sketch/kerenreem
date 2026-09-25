import type { Book, BookAvailability } from '@/lib/supabase/types';

/**
 * מצב הזמינות הציבורי של ספר — לעולם לא כמות מספרית (סעיף 11 במפרט).
 *
 * ממופה לפי סדר קבוע: קטלוג בלבד (אין חנות/לא ניתן לרכישה/אין מחיר) →
 * הזמנה מראש (אם הוגדרה) → במלאי → אזל זמנית. פונקציה טהורה אחת ולא
 * חישוב שחוזר על עצמו בכל רכיב שמציג מחיר או כפתור קנייה.
 */
export function getBookAvailability(
  book: Pick<
    Book,
    'is_purchasable' | 'price' | 'stock_quantity' | 'preorder_enabled' | 'is_stock_managed'
  >,
  storeEnabled: boolean,
): BookAvailability {
  if (!storeEnabled || !book.is_purchasable || book.price == null) return 'catalog_only';
  if (book.preorder_enabled) return 'preorder';

  /*
   * ‏[1.42] תיקון באג: ספר שסומן "בלי ניהול מלאי" זמין תמיד, גם כשהמונה 0.
   *
   * עד כה השורה הזו בדקה את stock_quantity לבדו והתעלמה מ-is_stock_managed.
   * ‏validateCart (lib/commerce/cart.ts:194) דווקא כן התייחס אליו, ולכן
   * שתי השכבות חלקו זו על זו:
   *
   *   • בקטלוג ובעמוד הספר — "אזל מהמלאי", בלי כפתור הוספה לסל.
   *   • בסל — העגלה ראתה אותו כלא-מנוהל, קיבלה כל כמות, והספר נמכר.
   *
   * כלומר מכירה אבודה דווקא בספרים שאמורים להיות זמינים תמיד: הדפסה לפי
   * דרישה, אספקה חיצונית, מוצר דיגיטלי. הלקוח לא יכול היה אפילו לנסות.
   *
   * ‏=== false במפורש, ולא ‎!== true: כששדה זה חסר בשליפה (undefined)
   * ההתנהגות נשארת כשהייתה — מנוהל. שליפה חסרה לא תהפוך בשקט ספר
   * שאזל לזמין, וזה הכיוון הבטוח לטעות.
   */
  if (book.is_stock_managed === false) return 'in_stock';

  return (book.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
}
