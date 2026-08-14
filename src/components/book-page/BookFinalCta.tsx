'use client';

import { useTranslations } from 'next-intl';
import { BookCover } from '@/components/BookCover';
import { useLocalList } from '@/lib/client-hooks';
import { AddToCartButton } from '../store/AddToCartButton';
import { ExternalSupplierButton } from './ExternalSupplierButton';
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
  externalSupplier,
}: {
  bookId: string;
  title: string;
  cover: string | null;
  price: string | null;
  showBuy: boolean;
  availability: BookAvailability;
  /** [1.9] מוגדר רק כשהעמוד קבע שיש להציג את כפתור הספק החיצוני עכשיו */
  externalSupplier?: { url: string; name: string } | null;
}) {
  const t = useTranslations('books');
  const { has, toggle } = useLocalList('kr:favourites');
  const isFavourite = has(bookId);

  return (
    <section
      id="book-final-cta"
      aria-labelledby="book-final-cta-heading"
      /* משטח סיום עם דעיכת זהב עדינה מלמעלה — מרים את הקטע מהרקע בלי קו
         כבד, באותה שפה של שאר המשטחים באתר. */
      className="relative mx-auto max-w-[52rem] overflow-hidden rounded-[var(--radius-xl)] border border-rule/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-gold)_7%,#fff),#fff)] px-6 py-10 text-center shadow-[var(--shadow-soft)] sm:px-10"
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
          <AddToCartButton bookId={bookId} title={title} availability={availability} />
        ) : null}
        {externalSupplier ? (
          <ExternalSupplierButton
            bookId={bookId}
            url={externalSupplier.url}
            supplierName={externalSupplier.name}
            variant={showBuy ? 'quiet' : 'solid'}
          />
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
