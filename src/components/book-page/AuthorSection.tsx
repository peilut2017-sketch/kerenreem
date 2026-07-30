import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { RichText } from '@/components/RichText';
import { BookCarousel } from './BookCarousel';
import type { Author, BookWithRelations } from '@/lib/supabase/types';

/**
 * אזור המחבר החי — לא כרטיס קטן בצד. תמונה, ביוגרפיה, שנות חיים אם
 * ידועות, וכל ספריו האחרים בקטלוג בקרוסלה אחת.
 */
export function AuthorSection({
  author,
  authorName,
  otherBooks,
  locale,
  t,
}: {
  author: Author;
  authorName: string;
  otherBooks: BookWithRelations[];
  locale: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const years =
    author.birth_year || author.death_year
      ? `${author.birth_year ?? ''}–${author.death_year ?? ''}`
      : null;

  return (
    <section aria-labelledby="book-author" className="grid gap-8 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <div>
        <div className="relative mx-auto aspect-square w-32 overflow-hidden rounded-full bg-cream-2 sm:w-full">
          {author.portrait_url ? (
            <Image src={author.portrait_url} alt={authorName} fill sizes="160px" className="object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center font-serif text-h3 text-ink-soft">
              {authorName.slice(0, 1)}
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 id="book-author" className="scroll-mt-[var(--book-nav-offset,6rem)] font-serif text-h2 text-ink">
          {authorName}
        </h2>
        {years ? <p className="mt-1 text-caption text-muted">{years}</p> : null}
        {author.bio_he ? (
          <div className="mt-4 max-w-prose">
            <RichText html={author.bio_he} />
          </div>
        ) : null}

        <p className="mt-4">
          <Link href={`/authors/${author.slug}`} className="link text-small">
            {t('authorPageLink')}
          </Link>
        </p>

        {otherBooks.length > 0 ? (
          <div className="mt-8">
            <h3 className="eyebrow mb-4">{t('authorAllBooks', { name: authorName })}</h3>
            <BookCarousel
              books={otherBooks}
              locale={locale}
              coverAltFor={(title) => t('coverAlt', { title })}
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
