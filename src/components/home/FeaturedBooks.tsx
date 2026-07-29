import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { Ornament } from '../Ornament';
import { Reveal } from '../Reveal';
import { localized } from '@/lib/localized';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * ספרים נבחרים — הנכס המרכזי של האתר.
 *
 * הפריסה א-סימטרית במכוון: כותר מוביל גדול על משטח מוגבה, ולצדו מדף של
 * כותרים נוספים בגובה אחיד. זה הבדל מהותי מרשת של כרטיסים זהים — העין
 * מקבלת נקודת כניסה אחת ואז סורקת את השאר.
 */
export async function FeaturedBooks({
  books,
  locale,
}: {
  books: BookWithRelations[];
  locale: string;
}) {
  const t = await getTranslations();
  if (books.length === 0) return null;

  const [lead, ...rest] = books;
  const leadTitle = localized(lead, 'title', locale);

  return (
    <section className="section-y">
      <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('home.catalogueLead')}</p>
            <h2 className="mt-2 font-serif text-[clamp(1.625rem,3.2vw,2.125rem)] text-ink">
              {t('home.catalogueTitle')}
            </h2>
          </div>
          <Link href="/books" className="link-more">
            {t('home.catalogueAll')}
          </Link>
        </header>

        <Ornament className="!justify-start" />

        <div className="mt-14 grid gap-x-8 gap-y-12 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:gap-x-16">
          {/* הכותר המוביל */}
          <Reveal>
            <Link href={`/books/${lead.slug}`} className="group block focus-visible:outline-offset-4">
              <div className="card card-interactive p-8">
                <div className="book-lift">
                  <BookCover
                    src={lead.cover_image_url}
                    title={leadTitle}
                    alt={t('books.coverAlt', { title: leadTitle })}
                    priority
                    sizes="(max-width: 1024px) 70vw, 260px"
                  />
                </div>
                <div className="mt-6 text-center">
                  <h3 className="font-serif text-h3 leading-snug text-ink transition-colors group-hover:text-burgundy">
                    {leadTitle}
                  </h3>
                  {lead.author ? (
                    <p className="mt-1.5 text-small text-muted">
                      {localized(lead.author, 'name', locale)}
                    </p>
                  ) : null}
                  <span className="link-more mt-4">{t('home.bookDetails')}</span>
                </div>
              </div>
            </Link>
          </Reveal>

          {/* המדף */}
          {rest.length > 0 ? (
            <ul className="grid grid-cols-2 gap-6 self-center sm:grid-cols-3 xl:grid-cols-4">
              {rest.map((book, index) => {
                const title = localized(book, 'title', locale);
                return (
                  <Reveal as="li" key={book.id} delay={index * 70}>
                    <Link
                      href={`/books/${book.slug}`}
                      className="card card-interactive group h-full items-center p-5 text-center focus-visible:outline-offset-4"
                    >
                      <div className="book-lift w-full">
                        <BookCover
                          src={book.cover_image_url}
                          title={title}
                          alt={t('books.coverAlt', { title })}
                          sizes="(max-width: 640px) 40vw, 180px"
                        />
                      </div>
                      <h3 className="mt-4 text-small font-semibold leading-snug text-ink transition-colors group-hover:text-burgundy">
                        {title}
                      </h3>
                      {book.author ? (
                        <p className="mt-1 text-caption text-muted">
                          {localized(book.author, 'name', locale)}
                        </p>
                      ) : null}
                    </Link>
                  </Reveal>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </section>
  );
}
