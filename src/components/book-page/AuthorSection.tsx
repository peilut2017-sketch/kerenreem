import { Img as Image } from '@/components/Img';
import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { RichText } from '@/components/RichText';
import { localized } from '@/lib/localized';
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
    <section aria-labelledby="book-author" className="grid grid-cols-1 gap-8 sm:grid-cols-[10rem_minmax(0,1fr)]">
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

        {author.timeline.length > 0 ? (
          <ol className="mt-8 flex gap-6 overflow-x-auto pb-1">
            {author.timeline.map((entry, index) => (
              <li key={index} className="relative min-w-32 shrink-0 border-t border-rule pt-3.5">
                <span aria-hidden="true" className="absolute -top-[3px] start-0 h-[5px] w-[5px] rounded-full bg-gold-deep" />
                <div className="text-caption text-gold-deep">{entry.year}</div>
                <div className="mt-1 text-small leading-snug text-ink-soft">{entry.text}</div>
              </li>
            ))}
          </ol>
        ) : null}

        {otherBooks.length > 0 ? (
          <div className="mt-8">
            <h3 className="eyebrow mb-4">{t('authorAllBooks', { name: authorName })}</h3>
            <ul className="flex flex-wrap gap-3">
              {otherBooks.map((book) => {
                const bookTitle = localized(book, 'title', locale);
                const note = book.category ? localized(book.category, 'name', locale) : null;
                return (
                  <li key={book.id}>
                    <Link
                      href={`/books/${book.slug}`}
                      className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-rule bg-cream-2/60 py-2 pe-4 ps-2 transition-colors hover:border-gold-deep"
                    >
                      <span className="w-8 shrink-0">
                        <BookCover
                          src={book.cover_image_url}
                          title={bookTitle}
                          alt={t('coverAlt', { title: bookTitle })}
                          sizes="34px"
                        />
                      </span>
                      <span>
                        <span className="block text-small text-ink group-hover:text-gold-deep">{bookTitle}</span>
                        {note ? <span className="block text-caption text-muted">{note}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
