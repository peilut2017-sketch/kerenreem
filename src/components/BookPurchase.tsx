import { useTranslations } from 'next-intl';
import type { Book } from '@/lib/supabase/types';

/**
 * גוש הרכישה בעמוד הספר.
 *
 * זהו ההבדל היחיד בין עמוד ספר בשלב הקטלוג לבין עמוד ספר בחנות. הוא מותנה
 * בשני תנאים: דגל `store_enabled` הגלובלי, ו-`is_purchasable` ברמת הספר.
 * כשהחנות תופעל, כאן ייכנס כפתור ההוספה לסל — ושום מקום אחר בעמוד לא ישתנה.
 */
export function BookPurchase({ book, storeEnabled }: { book: Book; storeEnabled: boolean }) {
  const t = useTranslations('books');

  if (!storeEnabled || !book.is_purchasable || book.price == null) return null;

  const inStock = (book.stock_quantity ?? 0) > 0;
  const price = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: book.currency ?? 'ILS',
    maximumFractionDigits: 2,
  }).format(book.price);

  return (
    <div className="mt-8 border-y border-rule-strong py-5">
      <p className="flex items-baseline gap-3">
        <span className="eyebrow">{t('price')}</span>
        <span className="font-serif text-h3 text-ink">{price}</span>
      </p>
      <button type="button" disabled={!inStock} className="btn btn-solid mt-4">
        {inStock ? t('addToCart') : t('outOfStock')}
      </button>
    </div>
  );
}
