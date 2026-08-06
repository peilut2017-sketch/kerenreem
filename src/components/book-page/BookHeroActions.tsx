'use client';

import { useState } from 'react';
import { FavouriteIcon } from '@/components/FavouriteIcon';
import { useTranslations } from 'next-intl';
import { useLocalList } from '@/lib/client-hooks';
import { ShelfPicker } from './ShelfPicker';
import { AddToCartButton } from '../store/AddToCartButton';
import type { BookAvailability } from '@/lib/supabase/types';

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
  availability,
  preorderDate,
}: {
  bookId: string;
  title: string;
  /** מחיר מעוצב מראש, או null כשאין מכירה — הרכיב אינו מעצב מטבע בעצמו */
  price: string | null;
  availability: BookAvailability;
  /** תאריך יציאה מעוצב מראש, רק כשהזמינות preorder */
  preorderDate?: string | null;
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
        <AddToCartButton bookId={bookId} title={title} availability={availability} />
      ) : null}

      {availability === 'preorder' && preorderDate ? (
        <span className="w-full text-caption text-muted lg:w-auto">
          {t('preorderRelease', { date: preorderDate })}
        </span>
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
        <FavouriteIcon active={isFavourite} className="h-4 w-4" />
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
