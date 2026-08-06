'use client';

import { useTranslations } from 'next-intl';
import { FavouriteIcon } from '@/components/FavouriteIcon';
import { Link } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { resolveBookAuthor } from '@/lib/books/author-display';
import { resolveBookBadge } from '@/lib/books/badge';
import { formatPrice, getEffectivePrice } from '@/lib/commerce/pricing';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * שורת ספר בתצוגת רשימה.
 *
 * לא גרסה דחוסה של הכרטיס אלא תצוגה אחרת: כאן יש מקום לתקציר, לשנה
 * ולמספר הכרכים — הנתונים שמאפשרים להשוות בין מהדורות בלי לפתוח כל אחת.
 * זה מה שהופך את התצוגה לשימושית למי שמכיר את הקטלוג.
 */
export function BookListRow({
  book,
  locale,
  isFavourite,
  onToggleFavourite,
  storeEnabled,
}: {
  book: BookWithRelations;
  locale: string;
  isFavourite: boolean;
  onToggleFavourite: (book: BookWithRelations) => void;
  storeEnabled: boolean;
}) {
  const t = useTranslations('books');
  const title = localized(book, 'title', locale);
  const author = resolveBookAuthor(book, locale);
  const categoryName = book.category ? localized(book.category, 'name', locale) : null;
  const summary = htmlToPlainText(localized(book, 'description', locale), 190);
  const badge = resolveBookBadge(book, locale, t('badgeFeatured'));
  const price = storeEnabled ? getEffectivePrice(book, locale) : null;

  return (
    <article className="card card-interactive group relative flex gap-5 p-4 sm:gap-6 sm:p-5">
      <div className="w-20 shrink-0 sm:w-24">
        <BookCover src={book.cover_image_url} title={title} alt={title} sizes="96px" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-[1.0625rem] leading-snug text-ink">
            <Link href={`/books/${book.slug}`} className="after:absolute after:inset-0 hover:text-burgundy">
              {title}
            </Link>
          </h3>
          {badge ? (
            <span
              className={`rounded-[var(--radius-pill)] px-2.5 py-0.5 text-caption font-semibold ${
                badge.tone === 'accent' ? 'bg-gold/15 text-gold-deep' : 'bg-cream-2 text-ink-soft'
              }`}
            >
              {badge.label}
            </span>
          ) : null}
        </div>

        {author ? <p className="mt-1 text-small text-muted">{author.name}</p> : null}
        {summary ? (
          <p className="mt-2 line-clamp-2 text-small leading-relaxed text-ink-soft">{summary}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-caption text-muted">
          {categoryName ? <span>{categoryName}</span> : null}
          {book.publication_year_he ? <span>{book.publication_year_he}</span> : null}
          {(book.volume_count ?? 1) > 1 ? <span>{book.volume_count} כרכים</span> : null}
          {book.pages ? <span>{book.pages} עמודים</span> : null}

          {price ? (
            <span className="ms-auto inline-flex items-baseline gap-1.5 font-serif text-[1rem] text-ink tabular-nums">
              {price.onSale && price.originalAmount != null ? (
                <s className="text-caption text-muted">{formatPrice(price.originalAmount, locale)}</s>
              ) : null}
              {formatPrice(price.amount, locale)}
            </span>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggleFavourite(book)}
        aria-pressed={isFavourite}
        aria-label={isFavourite ? t('favouriteRemoveNamed', { title }) : t('favouriteAddNamed', { title })}
        className={`relative z-20 h-9 w-9 shrink-0 self-start rounded-[var(--radius-pill)] transition-colors ${
          isFavourite ? 'text-burgundy' : 'text-muted hover:text-burgundy'
        }`}
      >
        <FavouriteIcon active={isFavourite} />
      </button>
    </article>
  );
}
