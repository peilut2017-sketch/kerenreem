import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { BookCover } from '@/components/BookCover';
import { BookGrid } from '@/components/BookGrid';
import { BookPurchase } from '@/components/BookPurchase';
import { RichText } from '@/components/RichText';
import { SectionHeading } from '@/components/SectionHeading';
import { getBookBySlug, getBookSlugs, getRelatedBooks, getSiteSettings } from '@/lib/data';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/sanitize';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;
// ספר שנוסף אחרי הבנייה יירנדר בבקשה הראשונה ואז ייכנס למטמון.
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getBookSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return {};

  const title = localized(book, 'title', locale);
  const subtitle = localizedOrNull(book, 'subtitle', locale);
  const description =
    htmlToPlainText(localized(book, 'description', locale), 160) || subtitle || title;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'book',
      images: book.cover_image_url ? [{ url: book.cover_image_url, alt: title }] : undefined,
    },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const t = await getTranslations('books');
  const [related, settings] = await Promise.all([getRelatedBooks(book), getSiteSettings()]);

  const title = localized(book, 'title', locale);
  const subtitle = localizedOrNull(book, 'subtitle', locale);
  const authorName = book.author ? localized(book.author, 'name', locale) : null;
  const categoryName = book.category ? localized(book.category, 'name', locale) : null;

  // שנת ההוצאה: העברית היא המקור התיעודי, הלועזית משלימה כשהיא ידועה.
  const year = [book.publication_year_he, book.publication_year_ce]
    .filter(Boolean)
    .join(book.publication_year_he && book.publication_year_ce ? ' · ' : '');

  const spec: [string, string][] = [
    authorName ? [t('author'), authorName] : null,
    categoryName ? [t('category'), categoryName] : null,
    year ? [t('publicationYear'), year] : null,
    book.volume_count && book.volume_count > 1 ? [t('volumes'), String(book.volume_count)] : null,
    book.pages ? [t('pages'), String(book.pages)] : null,
    book.format ? [t('format'), book.format] : null,
    book.binding ? [t('binding'), book.binding] : null,
    book.isbn ? [t('isbn'), book.isbn] : null,
  ].filter(Boolean) as [string, string][];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: title,
    ...(authorName ? { author: { '@type': 'Person', name: authorName } } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.pages ? { numberOfPages: book.pages } : {}),
    ...(book.publication_year_ce ? { datePublished: String(book.publication_year_ce) } : {}),
    ...(book.cover_image_url ? { image: book.cover_image_url } : {}),
    inLanguage: 'he',
    publisher: { '@type': 'Organization', name: 'מכון קרן רא״ם' },
  };

  return (
    <Container className="py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-[17rem] lg:mx-0">
          <BookCover
            src={book.cover_image_url}
            title={title}
            alt={t('coverAlt', { title })}
            priority
            sizes="(max-width: 1024px) 60vw, 272px"
          />
          {book.sample_pdf_url ? (
            <p className="mt-5">
              <a
                href={book.sample_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('sampleAria')}
                className="link text-small"
              >
                {t('sample')}
              </a>
            </p>
          ) : null}
        </div>

        <div>
          <h1 className="text-[clamp(1.75rem,3.4vw,2.5rem)] leading-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-3 text-lead text-muted">{subtitle}</p> : null}

          {book.author ? (
            <p className="mt-4 text-body">
              <Link href={`/authors/${book.author.slug}`} className="link text-ink-soft">
                {authorName}
              </Link>
            </p>
          ) : null}

          <BookPurchase book={book} storeEnabled={settings.store_enabled} />

          <div className="mt-8">
            <RichText html={localized(book, 'description', locale)} />
          </div>

          {spec.length > 0 ? (
            <section className="mt-12" aria-labelledby="book-spec">
              <h2 id="book-spec" className="eyebrow mb-4">
                {t('details')}
              </h2>
              <dl className="border-t border-rule">
                {spec.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule py-2.5 text-small"
                  >
                    <dt className="min-w-32 text-muted">{label}</dt>
                    <dd className="text-ink-soft">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
        </div>
      </article>

      {related.length > 0 ? (
        <section className="mt-20">
          <SectionHeading
            level={2}
            title={authorName ? t('otherByAuthor', { name: authorName }) : t('sameCategory')}
          />
          <BookGrid books={related} locale={locale} />
        </section>
      ) : null}
    </Container>
  );
}
