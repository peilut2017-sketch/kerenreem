'use client';

import { useTranslations } from 'next-intl';
import { useCart } from './CartProvider';
import type { BookAvailability } from '@/lib/supabase/types';

/**
 * כפתור ההוספה לסל האחד (פרק 2.1 במסמך האב) — מחליף את ארבעת הכפתורים
 * הדוממים. הזמינות מגיעה מהשרת (getBookAvailability) דרך העמוד; הרכיב
 * אינו מחשב זמינות ואינו מציג מחיר — רק פועל.
 *
 * כשהעגלה כבויה (הדגל השכבתי) הכפתור אינו מוצג כלל — התנהגות המתג
 * הקיימת נשמרת: מה שכבוי אינו קיים בעמוד, לא "מנוטרל".
 */
export function AddToCartButton({
  bookId,
  title,
  availability,
  variant = 'solid',
  className = '',
}: {
  bookId: string;
  title: string;
  availability: BookAvailability;
  variant?: 'solid' | 'quiet';
  className?: string;
}) {
  const t = useTranslations('books');
  const cart = useCart();

  if (!cart?.enabled || availability === 'catalog_only') return null;

  const label =
    availability === 'preorder'
      ? t('addToCartPreorder')
      : availability === 'out_of_stock'
        ? t('outOfStock')
        : t('addToCart');

  return (
    <button
      type="button"
      disabled={availability === 'out_of_stock'}
      onClick={() => cart.add(bookId, title)}
      className={`btn ${variant === 'solid' ? 'btn-solid' : 'btn-quiet'} ${className}`}
    >
      {label}
    </button>
  );
}
