'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocalList } from '@/lib/client-hooks';
import { ShelfPicker } from './ShelfPicker';

/**
 * שורת הפעולות ב-Hero: מחיר וקנייה (כשהחנות פעילה), שמירה למועדפים
 * ושיתוף — תמיד.
 *
 * הפעולה שתמיד קיימת היא "שמירה", לא "קנייה": כל עוד החנות סגורה זה
 * קטלוג, וההמשך הטבעי של מבקר שמצא ספר מעניין הוא לסמן אותו לעצמו.
 * הרכיב אינו מחליט מתי החנות פעילה — הוא מקבל את זה מוכן מהעמוד.
 */
export function BookHeroActions({
  bookId,
  title,
  price,
  inStock,
}: {
  bookId: string;
  title: string;
  /** מחיר מעוצב מראש, או null כשאין מכירה — הרכיב אינו מעצב מטבע בעצמו */
  price: string | null;
  inStock: boolean;
}) {
  const t = useTranslations('books');
  const { has, toggle } = useLocalList('kr:favourites');
  const [copied, setCopied] = useState(false);
  const isFavourite = has(bookId);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // המשתמש ביטל את חלון השיתוף — לא שגיאה שצריך להציג
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* אין clipboard API זמין — אין מה לעשות בלי דרך נוספת להעתיק */
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
      {price ? (
        <span className="font-serif text-h3 leading-none text-ink">{price}</span>
      ) : null}

      {price ? (
        <button type="button" disabled={!inStock} className="btn btn-solid">
          {inStock ? t('addToCart') : t('outOfStock')}
        </button>
      ) : null}

      <ShelfPicker bookId={bookId} />

      <button
        type="button"
        onClick={() => toggle(bookId)}
        aria-pressed={isFavourite}
        className={`btn btn-quiet inline-flex items-center gap-2 ${
          isFavourite ? 'text-burgundy' : ''
        }`}
      >
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="h-4 w-4"
          fill={isFavourite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M10 16.5S3.5 12.7 3.5 8.2A3.7 3.7 0 0 1 10 5.9a3.7 3.7 0 0 1 6.5 2.3c0 4.5-6.5 8.3-6.5 8.3Z" />
        </svg>
        {isFavourite ? t('favouriteRemove') : t('favouriteAdd')}
      </button>

      <button type="button" onClick={share} className="btn btn-quiet inline-flex items-center gap-2">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M14 6.5a2 2 0 1 0-1.9-2.6L7.8 6.2a2 2 0 1 0 0 2.9l4.3 2.3a2 2 0 1 0 .5-1L8.3 8.1a2 2 0 0 0 0-.7l4.3-2.3c.36.86 1.2 1.4 2.1 1.4Z" />
        </svg>
        {copied ? t('shareCopied') : t('share')}
      </button>
    </div>
  );
}
