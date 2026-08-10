'use client';

import { useTranslations } from 'next-intl';
import { useCart } from '@/components/store/CartProvider';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';

/**
 * [1.9] כפתור רכישה דרך ספק חיצוני — מוצג רק כשהוגדר בכרטיס הספר
 * (external_supplier_enabled + url + name). מי שמחליט האם להציג אותו
 * ברגע הזה (מול הרכישה הישירה אצלנו) הוא העמוד, לא הרכיב עצמו — בדיוק
 * כמו AddToCartButton שמקבל availability מוכן.
 *
 * הלחיצה נרשמת כאירוע מסחר (external_supplier_clicked) לצורך דוח
 * הביקוש (reports/books) — לא חוסמת את הניווט, רק "יורה ושוכחת".
 */
export function ExternalSupplierButton({
  bookId,
  url,
  supplierName,
  variant = 'quiet',
  className = '',
}: {
  bookId: string;
  url: string;
  supplierName: string;
  variant?: 'solid' | 'quiet';
  className?: string;
}) {
  const t = useTranslations('books');
  const cart = useCart();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void recordCommerceEvent('external_supplier_clicked', {
          sessionKey: cart?.sessionKey ?? 'no-session',
          bookId,
        }).catch(() => {});
      }}
      className={`btn ${variant === 'solid' ? 'btn-solid' : 'btn-quiet'} inline-flex items-center gap-2 ${className}`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M8 5H5a1.5 1.5 0 0 0-1.5 1.5v8A1.5 1.5 0 0 0 5 16h8a1.5 1.5 0 0 0 1.5-1.5v-3" strokeLinecap="round" />
        <path d="M12 4h4v4M16 4l-6.5 6.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t('buyFromSupplier', { supplier: supplierName })}
    </a>
  );
}
