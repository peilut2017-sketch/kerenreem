import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { BookPurchase } from '@/components/BookPurchase';
import { AuthorSection } from '@/components/book-page/AuthorSection';
import { BookHero } from '@/components/book-page/BookHero';
import { ConnectionsSection } from '@/components/book-page/ConnectionsSection';
import { FloatingActions } from '@/components/book-page/FloatingActions';
import { Gallery } from '@/components/book-page/Gallery';
import { KnowledgeMap, type KnowledgeMapNode } from '@/components/book-page/KnowledgeMap';
import { PdfFlipbook } from '@/components/book-page/PdfFlipbook';
import { QuoteCards } from '@/components/book-page/QuoteCards';
import { SeriesTimeline } from '@/components/book-page/SeriesTimeline';
import { StickyNav } from '@/components/book-page/StickyNav';
import { SummaryCard } from '@/components/book-page/SummaryCard';
import { TableOfContents } from '@/components/book-page/TableOfContents';
import { ViewTracker } from '@/components/book-page/ViewTracker';
import { getAuthorBySlug, getBookBySlug, getBookConnections, getBookSlugs, getSiteSettings } from '@/lib/data';
import { getCoverPalette } from '@/lib/cover-colors';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';

/**
 * חלון קצר במקום שעה, לא בגלל תעבורה אלא בגלל revalidatePath עצמו.
 *
 * נמדד ישירות: קריאה ל-revalidatePath, גם מ-Server Action וגם מ-Route
 * Handler, סימנה את המטמון לרענון אך לא שינתה בפועל את מה שמוגש לבקשה
 * הבאה מדפדפן חדש — נבדק עם Next.js 16.2.12 ובנייה עם Turbopack, שוב
 * ושוב, כולל אחרי המתנה ובקשות חוזרות. יתכן שזו התנהגות שונה בפריסה
 * אמיתית (Vercel), אבל אי אפשר להסתמך על זה בלי דרך לאמת. חלון של דקה
 * מבטיח שתוכן חדש יופיע גם אם הרענון היזום אינו פועל בפועל, ועדיין
 * שומר על מרבית התועלת של מטמון קצה עבור תעבורה אמיתית.
 */
export const revalidate = 60;
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
  const tValues = (key: string, values?: Record<string, string | number | Date>) => t(key, values);

  const [connections, settings, author, palette] = await Promise.all([
    getBookConnections(book),
    getSiteSettings(),
    book.author ? getAuthorBySlug(book.author.slug) : Promise.resolve(null),
    getCoverPalette(book.cover_image_url),
  ]);

  const title = localized(book, 'title', locale);
  const subtitle = localizedOrNull(book, 'subtitle', locale);
  const authorName = book.author ? localized(book.author, 'name', locale) : null;
  const categoryName = book.category ? localized(book.category, 'name', locale) : null;
  const description = localizedOrNull(book, 'description', locale);

  // שנת ההוצאה: העברית היא המקור התיעודי, הלועזית משלימה כשהיא ידועה.
  const year = [book.publication_year_he, book.publication_year_ce]
    .filter(Boolean)
    .join(book.publication_year_he && book.publication_year_ce ? ' · ' : '');

  const spec: [string, string][] = [
    year ? [t('publicationYear'), year] : null,
    book.volume_count && book.volume_count > 1 ? [t('volumes'), String(book.volume_count)] : null,
    book.pages ? [t('pages'), String(book.pages)] : null,
    book.format ? [t('format'), book.format] : null,
    book.binding ? [t('binding'), book.binding] : null,
    book.isbn ? [t('isbn'), book.isbn] : null,
    // המק״ט מוצג תמיד ולא רק כשהחנות פעילה: הוא המספר שבו פונים למשרד
    // כדי להזמין ספר גם בלי חנות מקוונת.
    [t('catalogueNumber'), String(book.catalogue_number)],
    book.sku ? [t('sku'), book.sku] : null,
  ].filter(Boolean) as [string, string][];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: title,
    ...(authorName ? { author: { '@type': 'Person', name: authorName } } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    ...(book.sku ? { sku: book.sku } : {}),
    ...(book.pages ? { numberOfPages: book.pages } : {}),
    ...(book.publication_year_ce ? { datePublished: String(book.publication_year_ce) } : {}),
    ...(book.cover_image_url ? { image: book.cover_image_url } : {}),
    inLanguage: 'he',
    publisher: { '@type': 'Organization', name: 'מכון קרן רא״ם' },
  };

  const hasConnections =
    connections.sameAuthor.length > 0 || connections.sameCategory.length > 0 || connections.sameTags.length > 0;

  const knowledgeNodes: KnowledgeMapNode[] = [
    { id: 'book-connections', label: t('knowledgeMapAuthor'), count: connections.sameAuthor.length },
    { id: 'book-connections', label: t('knowledgeMapCategory'), count: connections.sameCategory.length },
    ...(book.series ? [{ id: 'book-series', label: t('knowledgeMapSeries'), count: connections.sameSeries.length }] : []),
    { id: 'book-connections', label: t('knowledgeMapTags'), count: connections.sameTags.length },
  ];

  const sections = [
    { id: 'book-hero', label: t('navOverview') },
    description ? { id: 'book-summary', label: t('navSummary') } : null,
    book.toc && book.toc.length > 0 ? { id: 'book-toc', label: t('navToc') } : null,
    book.images && book.images.length > 0 ? { id: 'book-gallery', label: t('navGallery') } : null,
    author ? { id: 'book-author', label: t('navAuthor') } : null,
    book.series ? { id: 'book-series', label: t('navSeries') } : null,
    hasConnections ? { id: 'book-connections', label: t('navConnections') } : null,
  ].filter((section): section is { id: string; label: string } => section !== null);

  const showBuy = settings.store_enabled && book.is_purchasable && book.price != null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ViewTracker slug={book.slug} />

      <BookHero
        book={book}
        palette={palette}
        title={title}
        subtitle={subtitle}
        authorName={authorName}
        categoryName={categoryName}
        year={year}
        t={tValues}
      />

      <StickyNav sections={sections} cover={book.cover_image_url} title={title} />

      <Container className="space-y-20 py-16">
        <article className="mx-auto max-w-2xl">
          <div id="book-purchase">
            <BookPurchase book={book} storeEnabled={settings.store_enabled} />
          </div>

          {book.sample_pdf_url ? (
            <p className="mt-5">
              <PdfFlipbook pdfUrl={book.sample_pdf_url} title={title} />
            </p>
          ) : null}

          {spec.length > 0 ? (
            <section className="mt-10" aria-labelledby="book-spec">
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
        </article>

        {description ? <SummaryCard html={description} t={t} /> : null}

        {book.quotes.length > 0 ? <QuoteCards quotes={book.quotes} t={t} /> : null}

        {book.toc && book.toc.length > 0 ? <TableOfContents entries={book.toc} /> : null}

        {book.images && book.images.length > 0 ? (
          <Gallery images={book.images} title={title} t={tValues} />
        ) : null}

        {author ? (
          <AuthorSection
            author={author}
            authorName={authorName ?? author.name_he}
            otherBooks={connections.sameAuthor}
            locale={locale}
            t={tValues}
          />
        ) : null}

        {book.series && connections.sameSeries.length > 0 ? (
          <SeriesTimeline
            series={book.series}
            currentBook={book}
            volumes={connections.sameSeries}
            locale={locale}
            t={tValues}
          />
        ) : null}

        {hasConnections ? (
          <ConnectionsSection connections={connections} authorName={authorName} locale={locale} t={tValues} />
        ) : null}

        <KnowledgeMap nodes={knowledgeNodes} />
      </Container>

      <FloatingActions bookId={book.id} title={title} showBuy={showBuy} />
    </>
  );
}
