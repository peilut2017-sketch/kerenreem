'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLocalList } from '@/lib/client-hooks';
import { fetchFavouriteBooks } from '@/lib/commerce/favourites-actions';
import { BookCard } from '@/components/books/BookCard';
import { FavouriteIcon } from '@/components/FavouriteIcon';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * "הספרים שאהבתי" — הרשימה מהמכשיר (kr:favourites), הכרטיסים מהשרת.
 * הסרה מהעמוד מעדכנת מיידית; הספר נשאר על המסך עם מצב כבוי עד שהעמוד
 * נטען מחדש? לא — מוסר מיד: העמוד *הוא* הרשימה.
 */
export function FavouritesClient({
  locale,
  storeEnabled,
}: {
  locale: string;
  storeEnabled: boolean;
}) {
  const t = useTranslations('store');
  const { list: favouriteIds, toggle } = useLocalList('kr:favourites');
  const [books, setBooks] = useState<BookWithRelations[] | null>(null);

  // הכרטיסים נטענים כשקבוצת המזהים משתנה (כולל ההידרציה מהאחסון);
  // הסרות מן העמוד מסוננות מקומית — הקריאה חוזרת רק על תוספות
  const fetchedFor = useRef<string | null>(null);
  useEffect(() => {
    const key = [...favouriteIds].sort().join(',');
    if (fetchedFor.current === key) return;
    const isFirst = fetchedFor.current === null;
    const grew =
      !isFirst && favouriteIds.some((id) => !(fetchedFor.current ?? '').includes(id));
    fetchedFor.current = key;
    if (!isFirst && !grew) return; // רק הסרה — הסינון המקומי מספיק
    void (favouriteIds.length === 0
      ? Promise.resolve<BookWithRelations[]>([])
      : fetchFavouriteBooks(favouriteIds)
    )
      .then(setBooks)
      .catch(() => {
        // כשל רשת: איפוס מפתח השליפה כדי שרינדור/שינוי הבא ינסה שוב —
        // בלעדיו השלד המהבהב נשאר לנצח (books=null והשמירה מנעה ניסיון חוזר)
        fetchedFor.current = null;
        setBooks((prev) => prev ?? []);
      });
  }, [favouriteIds]);

  const current = new Set(favouriteIds);
  const visible = (books ?? []).filter((book) => current.has(book.id));

  if (books === null) {
    return (
      <div aria-hidden="true" className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-72 animate-pulse rounded-[var(--radius-lg)] bg-cream-2" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="mx-auto max-w-md py-14 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream-2 text-ink-soft">
          <FavouriteIcon active={false} className="h-7 w-7" />
        </span>
        <h2 className="mt-5 font-serif text-h3 text-ink">{t('favouritesEmptyTitle')}</h2>
        <p className="mt-2 text-small text-muted">{t('favouritesEmptyBody')}</p>
        <Link href="/books" className="btn btn-solid mt-6 inline-block">
          {t('favouritesEmptyCta')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-small text-muted" aria-live="polite">
        {t('favouritesCount', { count: visible.length })}
      </p>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((book) => (
          <BookCard
            key={book.id}
            book={book}
            locale={locale}
            isFavourite
            onToggleFavourite={(target) => toggle(target.id)}
            storeEnabled={storeEnabled}
          />
        ))}
      </div>
    </>
  );
}
