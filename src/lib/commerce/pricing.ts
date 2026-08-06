import type { Book } from '@/lib/supabase/types';

/**
 * שכבת המחיר האחת (פרק 2.1 במסמך האב): כל מקום שמציג, מחשב או מצלם
 * מחיר עובר כאן. אין עוד Intl.NumberFormat מקומי ואין ₪ משורשר.
 */

export interface EffectivePrice {
  /** המחיר לחיוב עכשיו */
  amount: number;
  /** המחיר הרגיל, כשהמחיר בפועל הוא מחיר מבצע */
  originalAmount: number | null;
  onSale: boolean;
  saleName: string | null;
}

type PricedBook = Pick<
  Book,
  'price' | 'sale_price' | 'sale_starts_at' | 'sale_ends_at' | 'sale_name_he' | 'sale_name_en'
>;

/**
 * המחיר בתוקף לרגע נתון: מחיר מבצע בתוך חלון התאריכים גובר על הרגיל.
 * מחזירה null כשאין מחיר בכלל (ספר קטלוג).
 */
export function getEffectivePrice(
  book: PricedBook,
  locale: string = 'he',
  now: Date = new Date(),
): EffectivePrice | null {
  if (book.price == null) return null;

  const sale = book.sale_price;
  const startsOk = !book.sale_starts_at || new Date(book.sale_starts_at) <= now;
  const endsOk = !book.sale_ends_at || new Date(book.sale_ends_at) >= now;
  const onSale = sale != null && sale >= 0 && sale < book.price && startsOk && endsOk;

  if (!onSale) {
    return { amount: round2(book.price), originalAmount: null, onSale: false, saleName: null };
  }
  return {
    amount: round2(sale!),
    originalAmount: round2(book.price),
    onSale: true,
    saleName: (locale === 'en' ? book.sale_name_en : book.sale_name_he) ?? book.sale_name_he,
  };
}

/** עיגול כספי עקבי לשתי ספרות — כל חישוב סכומים עובר דרכו. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * פרמוט המחיר האחיד. סכום עגול מוצג בלי אגורות, שבור — עם שתיים;
 * alwaysAgorot כופה שתי ספרות (מסכי כספים בניהול, מסמכים).
 */
export function formatPrice(
  amount: number,
  locale: string = 'he',
  options?: { currency?: string; alwaysAgorot?: boolean },
): string {
  const currency = options?.currency ?? 'ILS';
  const whole = round2(amount) % 1 === 0;
  const digits = options?.alwaysAgorot ? 2 : whole ? 0 : 2;

  return new Intl.NumberFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits === 0 ? 0 : 2,
    maximumFractionDigits: digits === 0 ? 0 : 2,
  }).format(amount);
}
