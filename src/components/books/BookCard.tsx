'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { localized } from '@/lib/localized';
import { resolveBookAuthor } from '@/lib/books/author-display';
import { resolveBookBadge } from '@/lib/books/badge';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * כרטיס הספר — האלמנט המרכזי בקטלוג.
 *
 * הכריכה נושאת את הכרטיס, ולכן היא מקבלת את מרבית השטח. הפעולות המהירות
 * מופיעות במעבר עכבר אבל **נשארות בסדר הטאב תמיד**: פעולה שמופיעה רק
 * ב-hover אינה קיימת עבור מי שמנווט במקלדת. focus-within מחזיר אותן
 * לתצוגה גם כשמגיעים אליהן בטאב.
 */
export function BookCard({
  book,
  locale,
  priority,
  isFavourite,
  onToggleFavourite,
  storeEnabled,
}: {
  book: BookWithRelations;
  locale: string;
  priority?: boolean;
  isFavourite: boolean;
  onToggleFavourite: (book: BookWithRelations) => void;
  storeEnabled: boolean;
}) {
  const t = useTranslations('books');
  const title = localized(book, 'title', locale);
  const author = resolveBookAuthor(book, locale);
  const categoryName = book.category ? localized(book.category, 'name', locale) : null;
  const badge = resolveBookBadge(book, locale, t('badgeFeatured'));

  return (
    <article className="card card-interactive group relative flex h-full flex-col focus-within:ring-2 focus-within:ring-gold/50">
      <div className="relative overflow-hidden rounded-t-[var(--radius-lg)] bg-cream-2 p-5">
        <div className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-[1.02] motion-reduce:transform-none">
          <BookCover
            src={book.cover_image_url}
            title={title}
            alt={title}
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          />
        </div>

        {/* פינת הפתיחה שומרת לתגית (מבצע/רב מכר/בחירת המכון) — הפוכה
            לפינת הסיום שבה יושב הלב, כדי ששתיהן לא יתנגשו. */}
        {badge ? (
          <span
            className={`glass absolute start-3 top-3 z-10 rounded-[var(--radius-pill)] px-2.5 py-1 text-caption font-semibold ${
              badge.tone === 'accent' ? 'text-gold-deep' : 'text-ink-soft'
            }`}
          >
            {badge.label}
          </span>
        ) : null}

        <FavouriteButton
          title={title}
          isFavourite={isFavourite}
          onToggle={() => onToggleFavourite(book)}
        />
      </div>

      <div className="flex flex-1 flex-col p-5 pt-4">
        <h3 className="font-serif text-[1.0625rem] leading-snug text-ink">
          {/* הקישור פרוש על כל הכרטיס, כך שכל השטח לחיץ ובכל זאת יש רק
              יעד אחד בסדר הטאב — כרטיס עם שלושה קישורים לאותו מקום מכפיל
              את מספר העצירות לקורא מסך. */}
          <Link href={`/books/${book.slug}`} className="after:absolute after:inset-0 hover:text-burgundy">
            {title}
          </Link>
        </h3>

        {author ? <p className="mt-1.5 text-small text-muted">{author.name}</p> : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {categoryName ? (
            <span className="rounded-[var(--radius-pill)] bg-cream-2 px-2.5 py-1 text-caption text-ink-soft">
              {categoryName}
            </span>
          ) : null}

          {storeEnabled && book.price !== null && book.price !== undefined ? (
            <span className="ms-auto font-serif text-[1.05rem] text-ink tabular-nums">
              {new Intl.NumberFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
                style: 'currency',
                currency: book.currency ?? 'ILS',
                maximumFractionDigits: 0,
              }).format(Number(book.price))}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FavouriteButton({
  title,
  isFavourite,
  onToggle,
}: {
  title: string;
  isFavourite: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('books');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavourite}
      aria-label={isFavourite ? t('favouriteRemoveNamed', { title }) : t('favouriteAddNamed', { title })}
      /* z-20 מעל שכבת הקישור הפרוש, אחרת הלחיצה על הלב פותחת את הספר */
      className={`glass absolute end-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] transition-[opacity,transform,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 focus-visible:opacity-100 motion-reduce:transition-none ${
        isFavourite
          ? 'text-burgundy opacity-100'
          : 'text-ink-soft opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-4.5 w-4.5" aria-hidden="true">
        <path
          d="M10 16.5S3 12.4 3 7.9A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 7 1.9c0 4.5-7 8.6-7 8.6Z"
          fill={isFavourite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          className={isFavourite ? 'origin-center animate-[fav_320ms_var(--ease-spring)]' : ''}
        />
      </svg>
    </button>
  );
}
