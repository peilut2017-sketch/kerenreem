'use client';

import { useTranslations } from 'next-intl';
import { useLocalList } from '@/lib/client-hooks';
import { BookCard } from '../books/BookCard';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * הספרים הנצפים ביותר, מתחת למדף — לא כשדרות על מדף כמו BookShelf,
 * אלא כרטיסי "פריט בחנות" רגילים (BookCard, אותו רכיב שבקטלוג), כדי
 * שהמבקר יזהה מיד "אלה ספרים לבחירה" ולא עוד קישוט של המדף שמעליהם.
 *
 * כרטיס התווית ("הנצפים ביותר") באותה שורה ובאותו משקל חזותי כמו כרטיסי
 * הספרים לצדו — לא כותרת נפרדת מעליהם.
 */
export function MostViewedRow({
  books,
  locale,
  storeEnabled,
}: {
  books: BookWithRelations[];
  locale: string;
  storeEnabled: boolean;
}) {
  const t = useTranslations('home');
  const { list: favouriteIds, toggle } = useLocalList('kr:favourites');
  const favourites = new Set(favouriteIds);

  if (books.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      <li>
        <div className="card flex h-full flex-col items-center justify-center gap-3 px-4 py-8 text-center">
          <span aria-hidden="true" className="icon-chip h-12 w-12 text-gold-deep">
            <EyeIcon />
          </span>
          <span className="font-serif text-[1.0625rem] leading-snug text-ink">{t('mostViewedTitle')}</span>
          <span className="text-caption text-muted">{t('mostViewedHint')}</span>
        </div>
      </li>

      {books.map((book, index) => (
        <li key={book.id}>
          <BookCard
            book={book}
            locale={locale}
            priority={index === 0}
            isFavourite={favourites.has(book.id)}
            onToggleFavourite={(target) => toggle(target.id)}
            storeEnabled={storeEnabled}
          />
        </li>
      ))}
    </ul>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
