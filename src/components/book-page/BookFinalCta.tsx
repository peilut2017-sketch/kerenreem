'use client';

import { useTranslations } from 'next-intl';
import { BookCover } from '@/components/BookCover';
import { useLocalList } from '@/lib/client-hooks';
import type { BookAvailability } from '@/lib/supabase/types';

/**
 * אזור סיום שקט — לא חזרה על כל פרטי ה-Hero (סעיף 23 במפרט), רק כריכה
 * זעירה, שם, מחיר (כשהחנות פעילה) וכפתור אחד. הכותרת משתנה לפי מצב
 * החנות: "נשמר לך להמשך" בקטלוג, "מוכן להוסיף לספרייה שלך?" כשיש קנייה.
 */
export function BookFinalCta({
  bookId,
  title,
  cover,
  price,
  showBuy,
  availability,
}: {
  bookId: string;
  title: string;
  cover: string | null;
  price: string | null;
  showBuy: boolean;
  availability: BookAvailability;
}) {
  const t = useTranslations('books');
  const { has, toggle } = useLocalList('kr:favourites');
  const isFavourite = has(bookId);
  const buyLabel =
    availability === 'preorder'
      ? t('addToCartPreorder')
      : availability === 'out_of_stock'
        ? t('outOfStock')
        : t('addToCart');

  return (
    <section
      id="book-final-cta"
      aria-labelledby="book-final-cta-heading"
      className="mx-auto max-w-[52rem] rounded-[var(--radius-xl)] border border-rule bg-cream-2/60 px-6 py-10 text-center sm:px-10"
    >
      <div className="mx-auto w-24">
        <BookCover src={cover} title={title} alt="" sizes="96px" />
      </div>

      <h2 id="book-final-cta-heading" className="mt-6 font-serif text-h2 text-ink">
        {showBuy ? t('finalCtaTitleStore') : t('finalCtaTitleCatalog')}
      </h2>
      <p className="mt-2 text-lead text-muted">{title}</p>
      {price ? <p className="mt-1 font-serif text-h3 text-ink">{price}</p> : null}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        {showBuy ? (
          <button type="button" disabled={availability === 'out_of_stock'} className="btn btn-solid">
            {buyLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => toggle(bookId)}
          aria-pressed={isFavourite}
          className={`btn btn-quiet ${isFavourite ? 'text-burgundy' : ''}`}
        >
          {isFavourite ? t('favouriteRemove') : t('favouriteAdd')}
        </button>
      </div>
    </section>
  );
}
