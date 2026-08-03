import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { BookCover } from '@/components/BookCover';
import { getBooks } from '@/lib/data';
import { localized } from '@/lib/localized';

/**
 * ספר שלא נמצא (או שאינו מפורסם) — לא רק הודעת שגיאה, גם דרך המשך:
 * חזרה לקטלוג, וכמה ספרים אמיתיים מהקטלוג הקיים. לא ספרי דמה, ולא
 * "פופולרי" מומצא — מיון לפי מונה הצפיות הגס שכבר קיים על הספר.
 */
export default async function BookNotFound() {
  const locale = await getLocale();
  const t = await getTranslations('books');

  const books = await getBooks();
  const popular = [...books].sort((a, b) => b.view_count - a.view_count).slice(0, 4);

  return (
    <Container className="py-20 lg:py-28">
      <div className="max-w-[46rem]">
        <h1 className="text-h1 text-ink">{t('bookNotFoundTitle')}</h1>
        <p className="mt-4 text-lead text-muted">{t('bookNotFoundBody')}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/books" className="btn btn-solid">
            {t('browseCatalogue')}
          </Link>
        </div>
      </div>

      {popular.length > 0 ? (
        <div className="mt-16 border-t border-rule pt-12">
          <h2 className="font-serif text-h3 text-ink">{t('discoverPopular')}</h2>
          <ul className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {popular.map((book) => {
              const title = localized(book, 'title', locale);
              return (
                <li key={book.id}>
                  <Link href={`/books/${book.slug}`} className="group block">
                    <BookCover src={book.cover_image_url} title={title} alt={t('coverAlt', { title })} />
                    <p className="mt-3 line-clamp-2 text-small text-ink-soft group-hover:text-gold-deep">
                      {title}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Container>
  );
}
