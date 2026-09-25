'use server';

import { createStaticClient } from '@/lib/supabase/server';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { getBookAvailability } from './availability';
import type { Book, BookAvailability } from '@/lib/supabase/types';

/**
 * ‏[1.42] זמינות חיה — הוצאת המלאי מהעמוד הסטטי.
 *
 * ## הבעיה
 *
 * ‏getBookAvailability נקרא ב-server component, ולכן מצב המלאי **נצרב**
 * ב-HTML הסטטי. משמעות הדבר בשני הכיוונים:
 *
 *  • עמוד שנבנה כשהספר היה במלאי, והמלאי אזל — הכפתור פעיל, הלקוח
 *    לוחץ, ו-validateCart מסרב לו רגע אחר כך. מעצבן, אבל **בטוח**: אין
 *    ‏oversell, כי גם העגלה וגם placeOrder בודקים מול המסד.
 *  • עמוד שנבנה כשהספר אזל, והמלאי **חזר** — הכפתור לא קיים בכלל.
 *    הלקוח אינו יכול אפילו לנסות, ושום בדיקת שרת לא תציל את זה. **זו
 *    מכירה אבודה**, וזה הכיוון המסוכן יותר.
 *
 * הפתרון עד כה היה ‎revalidate = 60 על כל עמוד שמציג ספר: העמוד נכתב
 * מחדש בכל דקה, לנצח, רק כדי שהזמינות לא תתיישן. זה שילם על שינוי נדיר
 * בכתיבה תמידית.
 *
 * ## הפתרון כאן
 *
 * העמוד נשאר סטטי; הזמינות נטענת אחרי ה-hydration בבקשה **אחת** לכל
 * העמוד (ראו AvailabilityProvider). כך שריון, פקיעת שריון, תשלום וכל
 * תנועת מלאי אינם מצריכים לרענן שום עמוד — הם משתקפים מיד ממילא.
 *
 * ## למה אותה פונקציה בדיוק ולא חישוב מקביל
 *
 * ‏getBookAvailability היא אותה פונקציה טהורה שהעמוד השתמש בה ברינדור,
 * ואותה שמשמשת את validateCart. שלושת המקומות אינם יכולים לחלוק על
 * עצמם, וזה מכוון: זמינות שמחושבת בשתי נוסחאות שונות היא באג שממתין.
 */

/** מה שה-UI צריך כדי להחליט מה להציג. לעולם לא כמות מדויקת ללקוח. */
export interface LiveAvailability {
  bookId: string;
  availability: BookAvailability;
  /**
   * הכמות הזמינה, או null כשהמלאי אינו מנוהל. מוחזרת כדי ש-UI יוכל
   * להציג "נשאר עותק אחד" — לא כדי להציג מספר מלאי. ראו סעיף 11 באפיון:
   * מצב זמינות, לא מספר.
   */
  availableQuantity: number | null;
  /** האם ניתן להוסיף לסל כרגע. */
  purchasable: boolean;
}

/**
 * תקרה על מספר המזהים בבקשה. עמוד קטלוג מציג עשרות, לא מאות; התקרה
 * חוסמת שימוש לרעה בלי להגביל שום מסך אמיתי. ‏.in() עם אלפי מזהים הוא
 * גם שאילתה שמפילה את המסד.
 */
const MAX_IDS = 120;

const COLUMNS = 'id, is_purchasable, price, stock_quantity, preorder_enabled, is_stock_managed';

export async function getLiveAvailability(bookIds: string[]): Promise<LiveAvailability[]> {
  // דה-דופליקציה כאן ולא רק בצד הלקוח: הפעולה חשופה כ-Server Action
  // ואינה יכולה להניח שהקורא ניקה את הקלט.
  const ids = [...new Set(bookIds.filter((id) => typeof id === 'string' && id !== ''))].slice(
    0,
    MAX_IDS,
  );
  if (ids.length === 0) return [];

  const supabase = createStaticClient();
  if (!supabase) return [];

  /*
   * שאילתה אחת לכל המזהים — זה כל העניין. בקשה לכל כרטיס הייתה N+1
   * גם ברשת וגם במסד, ובעמוד קטלוג עם 24 כרטיסים זה 24 סבבים.
   *
   * ‏getCommerceFlags במקביל ולא בטור: הוא ‎cache()‎ ולכן זול, אבל אין
   * סיבה להמתין לו לפני שאילתת הספרים.
   */
  const [flags, result] = await Promise.all([
    getCommerceFlags(),
    supabase.from('books').select(COLUMNS).in('id', ids).eq('is_published', true),
  ]);

  if (result.error) {
    // כשל כאן אינו קריטי: הלקוח נשאר עם הזמינות שנצרבה בעמוד, וכל
    // פעולת קנייה עוברת בכל מקרה דרך validateCart. לכן מערך ריק ולא זריקה.
    console.error('[books:availability] live', result.error.message);
    return [];
  }

  return ((result.data ?? []) as unknown as Book[]).map((book) => {
    const availability = getBookAvailability(book, flags.storeEnabled);
    const managed = book.is_stock_managed !== false && !book.preorder_enabled;
    return {
      bookId: book.id,
      availability,
      availableQuantity: managed ? Math.max(book.stock_quantity ?? 0, 0) : null,
      purchasable: availability === 'in_stock' || availability === 'preorder',
    };
  });
}
