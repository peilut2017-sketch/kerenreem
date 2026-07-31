'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookCard } from './BookCard';
import { useLocalList } from '@/lib/client-hooks';
import { localized } from '@/lib/localized';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * רשת כרטיסי ספרים לשימוש מחוץ לקטלוג — בעמוד הבית ובעמודי מחבר.
 *
 * אותו כרטיס בדיוק כמו בקטלוג, כולל המועדפים: ספר שסומן בעמוד הבית מופיע
 * מסומן גם בקטלוג, כי שניהם קוראים מאותו אחסון מקומי. שני כרטיסים שנראים
 * זהים ומתנהגים אחרת הם הדבר שמלמד משתמשים לא לסמוך על הממשק.
 */
export function BookCardGrid({
  books,
  locale,
  storeEnabled,
  priorityCount = 0,
}: {
  books: BookWithRelations[];
  locale: string;
  storeEnabled: boolean;
  priorityCount?: number;
}) {
  const t = useTranslations('books');
  const { list, toggle } = useLocalList('kr:favourites');
  const favourites = useMemo(() => new Set(list), [list]);
  const [toast, setToast] = useState<string | null>(null);

  const onToggleFavourite = useCallback(
    (book: BookWithRelations) => {
      const added = toggle(book.id);
      setToast(
        added
          ? t('favouriteAdded', { title: localized(book, 'title', locale) })
          : t('favouriteRemoved'),
      );
      window.setTimeout(() => setToast(null), 2600);
    },
    [toggle, locale, t],
  );

  if (books.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {books.map((book, index) => (
          <li key={book.id}>
            <BookCard
              book={book}
              locale={locale}
              priority={index < priorityCount}
              isFavourite={favourites.has(book.id)}
              onToggleFavourite={onToggleFavourite}
              storeEnabled={storeEnabled}
            />
          </li>
        ))}
      </ul>

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
      >
        {toast ? (
          <p className="glass rounded-[var(--radius-pill)] px-5 py-2.5 text-small text-ink shadow-[var(--shadow-float)]">
            {toast}
          </p>
        ) : null}
      </div>
    </>
  );
}
