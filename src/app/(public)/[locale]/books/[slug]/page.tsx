import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { AuthorSection } from '@/components/book-page/AuthorSection';
import { BookBreadcrumbs } from '@/components/book-page/BookBreadcrumbs';
import { BookHero } from '@/components/book-page/BookHero';
import { BookHeroActions } from '@/components/book-page/BookHeroActions';
import { ConnectionsSection } from '@/components/book-page/ConnectionsSection';
import { FloatingActions } from '@/components/book-page/FloatingActions';
import { ReportBookButton } from '@/components/book-page/ReportBookButton';
import { Gallery } from '@/components/book-page/Gallery';
import { BookFlipViewer } from '@/components/book-page/BookFlipViewer';
import { BookSampleViewer } from '@/components/book-page/BookSampleViewer';
import { KnowledgeSpace } from '@/components/book-page/KnowledgeSpace';
import { QuoteCards } from '@/components/book-page/QuoteCards';
import { SeriesTimeline } from '@/components/book-page/SeriesTimeline';
import { SpecGrid, type SpecItem } from '@/components/book-page/SpecGrid';
import { StickyNav } from '@/components/book-page/StickyNav';
import { SummaryCard } from '@/components/book-page/SummaryCard';
import { TableOfContents } from '@/components/book-page/TableOfContents';
import { ViewTracker } from '@/components/book-page/ViewTracker';
import { getAuthorBySlug, getBookBySlug, getBookConnections, getBookSlugs } from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { getCoverPalette } from '@/lib/cover-colors';
import { getBookAvailability } from '@/lib/books/availability';
import { formatPrice, getEffectivePrice } from '@/lib/commerce/pricing';
import { resolveBookAuthor } from '@/lib/books/author-display';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { toCdnUrl } from '@/lib/image-src';
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
  const { locale, slug: rawSlug } = await params;
  // [1.9] מזהי כתובת בעברית מגיעים מ-Next כאן עדיין percent-encoded
  // (%D7%A4...) — לא מפוענחים אוטומטית כמו שהיה נהוג להניח. בלי הפענוח
  // כאן ההשוואה ל-slug השמור (עברית רגילה) במסד לעולם לא תואמת, וכל עמוד
  // עם כתובת עברית "לא נמצא" בפועל.
  const slug = decodeURIComponent(rawSlug);
  const book = await getBookBySlug(slug);
  if (!book) return {};

  const bookTitle = localized(book, 'title', locale);
  const subtitle = localizedOrNull(book, 'subtitle', locale);
  // שדות ה-SEO שהעורך מילא בכרטיס הספר (זיהוי וחיפוש) גוברים על הגזירה
  // האוטומטית — עד עכשיו הם נשמרו ונוקדו במד ההשלמה אך מעולם לא הוצגו.
  const title = book.meta_title || bookTitle;
  const description =
    book.meta_description ||
    htmlToPlainText(localized(book, 'description', locale), 160) ||
    subtitle ||
    bookTitle;
  // toCdnUrl: כתובת שנשמרה לפני מעבר ספק אחסון מיושרת לבסיס הנוכחי —
  // og:image שבור לא מפיל את העמוד, אבל שובר את התצוגה המקדימה בשיתוף.
  const rawOgImage = book.og_image_url ?? book.cover_image_url;
  const ogImage = rawOgImage ? toCdnUrl(rawOgImage) : rawOgImage;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const canonicalUrl = book.canonical_url ?? `${siteUrl}${localePrefix}/books/${book.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: Object.fromEntries(
        routing.locales.map((loc) => [
          loc,
          `${siteUrl}${loc === routing.defaultLocale ? '' : `/${loc}`}/books/${book.slug}`,
        ]),
      ),
    },
    openGraph: {
      title,
      description,
      type: 'book',
      url: canonicalUrl,
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);

  const book = await getBookBySlug(slug);
  if (!book) notFound();

  const t = await getTranslations('books');
  const tValues = (key: string, values?: Record<string, string | number | Date>) => t(key, values);

  // מחבר כטקסט חופשי (author_name_he/en) גובר על השיוך לרשומה, ולכן גם
  // מדכא את שליפת המחבר המלא: אחרת אזור המחבר בהמשך העמוד (עם דיוקן
  // וביוגרפיה) היה מציג אדם אחר לגמרי ממי שמופיע ב-Hero.
  const authorDisplay = resolveBookAuthor(book, locale);

  const [connections, flags, author, extractedPalette] = await Promise.all([
    getBookConnections(book),
    getCommerceFlags(),
    book.author && authorDisplay?.href ? getAuthorBySlug(book.author.slug) : Promise.resolve(null),
    // אין טעם לחלץ צבע מהכריכה כשכבר הוגדרו גוונים ידנית בניהול —
    // חיסכון בעבודת sharp/k-means שהתוצאה שלה ממילא לא תוצג.
    book.accent_primary ? Promise.resolve(null) : getCoverPalette(book.cover_image_url),
  ]);

  // גוונים ידניים (accent_primary/secondary, סעיף 6 במפרט) גוברים על
  // החילוץ האוטומטי מהכריכה; החילוץ נשאר ברירת המחדל כשלא הוגדרו.
  const palette = book.accent_primary
    ? {
        colors: [
          book.accent_primary,
          book.accent_secondary ?? book.accent_primary,
          book.accent_secondary ?? book.accent_primary,
        ] as [string, string, string],
      }
    : extractedPalette!;

  const title = localized(book, 'title', locale);
  const subtitle = localizedOrNull(book, 'subtitle', locale);
  const categoryName = book.category ? localized(book.category, 'name', locale) : null;
  const description = localizedOrNull(book, 'description', locale);
  const descriptionBrief = localizedOrNull(book, 'description_brief', locale);

  // שנת ההוצאה: העברית היא המקור התיעודי, הלועזית משלימה כשהיא ידועה.
  const year = [book.publication_year_he, book.publication_year_ce]
    .filter(Boolean)
    .join(book.publication_year_he && book.publication_year_ce ? ' · ' : '');

  const LANGUAGE_NAMES: Record<string, string> = {
    he: t('langHe'), en: t('langEn'), yi: t('langYi'),
    fr: t('langFr'), ru: t('langRu'), es: t('langEs'),
  };

  const publisher = localizedOrNull(book, 'publisher', locale);
  const edition = localizedOrNull(book, 'edition', locale);

  // דפי דוגמה שהומרו מראש בניהול. כשהם קיימים הם *מחליפים* את קורא
  // ה-PDF החי: אין טעם להציג את אותה דוגמה פעמיים, ובוודאי לא לטעון
  // pdf.js אצל המבקר כשיש כבר WebP מוכן.
  const previewPages = book.previewPages ?? [];
  const showInlineSample = previewPages.length === 0 && Boolean(book.sample_pdf_url);

  const spec: SpecItem[] = [
    publisher ? { icon: 'publisher', label: t('publisher'), value: publisher } : null,
    edition ? { icon: 'edition', label: t('edition'), value: edition } : null,
    book.pages ? { icon: 'pages', label: t('pages'), value: String(book.pages) } : null,
    book.volume_count && book.volume_count > 1
      ? { icon: 'binding', label: t('volumes'), value: String(book.volume_count) }
      : null,
    book.binding ? { icon: 'binding', label: t('binding'), value: book.binding } : null,
    book.weight_grams ? { icon: 'weight', label: t('weight'), value: t('grams', { n: book.weight_grams }) } : null,
    book.languages && book.languages.length > 0
      ? {
          icon: 'language',
          label: t('language'),
          value: book.languages.map((code) => LANGUAGE_NAMES[code] ?? code).join(', '),
        }
      : null,
    book.isbn ? { icon: 'isbn', label: t('isbn'), value: book.isbn } : null,
    // המק״ט מוצג תמיד ולא רק כשהחנות פעילה: הוא המספר שבו פונים למשרד
    // כדי להזמין ספר גם בלי חנות מקוונת.
    { icon: 'isbn', label: t('catalogueNumber'), value: String(book.catalogue_number) },
    book.sku ? { icon: 'isbn', label: t('sku'), value: book.sku } : null,
  ].filter((item): item is SpecItem => item !== null);

  // כתובת מוחלטת: נדרשת ל-canonical, ל-BreadcrumbList ולזמינות ה-Offer,
  // ולא רק לתצוגה — לכן מחושבת פעם אחת כאן ולא מושארת יחסית.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const localePrefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  const canonicalUrl = `${siteUrl}${localePrefix}/books/${book.slug}`;
  const categoryHref = book.category ? `/books?category=${book.category.slug}` : null;

  const hasConnections =
    connections.manual.length > 0 ||
    connections.sameSeries.length > 0 ||
    connections.sameAuthor.length > 0 ||
    connections.sameCategory.length > 0 ||
    connections.sameTags.length > 0;

  // [1.6] "מרחב ידע" (ט.17) — תגיות נושא עם הסבר (description_he),
  // בלי תגיות מערכת ("חדש"/"נבחר", ראו SmartTag.tsx)
  const hasKnowledgeSpace = (book.tags ?? []).some(
    (tag) => tag.slug !== 'new' && tag.slug !== 'bestseller' && tag.description_he,
  );

  const sections = [
    { id: 'book-hero', label: t('navOverview') },
    description ? { id: 'book-summary', label: t('navSummary') } : null,
    previewPages.length > 0 || showInlineSample ? { id: 'book-sample', label: t('readSample') } : null,
    book.toc && book.toc.length > 0 ? { id: 'book-toc', label: t('navToc') } : null,
    hasKnowledgeSpace ? { id: 'book-knowledge', label: t('navKnowledge') } : null,
    book.images && book.images.length > 0 ? { id: 'book-gallery', label: t('navGallery') } : null,
    author ? { id: 'book-author', label: t('navAuthor') } : null,
    book.series ? { id: 'book-series', label: t('navSeries') } : null,
    hasConnections ? { id: 'book-connections', label: t('navConnections') } : null,
  ].filter((section): section is { id: string; label: string } => section !== null);

  const availability = getBookAvailability(book, flags.showPrices);
  const showBuy = availability !== 'catalog_only';
  const effectivePrice = showBuy ? getEffectivePrice(book, locale) : null;
  const formattedPrice = effectivePrice ? formatPrice(effectivePrice.amount, locale) : null;

  // [1.9] הכפתור מוצג רק כשהוגדר ספק חיצוני, וכש-showBuy=false (הספר לא
  // נמכר אצלנו בפועל — לא ניתן לרכישה, או שהחנות/המחירים כבויים) או שהוגדר
  // מפורשות להציג אותו גם כשכן נמכר אצלנו (external_supplier_always_show).
  const externalSupplier =
    book.external_supplier_enabled && book.external_supplier_url && book.external_supplier_name
      ? (!showBuy || book.external_supplier_always_show
          ? { url: book.external_supplier_url, name: book.external_supplier_name }
          : null)
      : null;
  const formattedPreorderDate =
    availability === 'preorder' && book.preorder_release_date
      ? new Intl.DateTimeFormat(locale === 'en' ? 'en' : 'he', { dateStyle: 'long' }).format(
          new Date(book.preorder_release_date),
        )
      : null;

  // עד שני תגים (סעיף 8): "בקרוב" קודם ל"בחירת המכון", ושניהם קודמים
  // לתג המהדורה (categoryName + שנה) שממשיך להיות מוצג ב-BookHero כברירת
  // מחדל כשאין תג סטטוס.
  const badges = [
    availability === 'preorder' ? t('statusPreorder') : null,
    book.is_featured ? t('badgeFeatured') : null,
  ].filter((badge): badge is string => badge !== null);

  const nav = await getTranslations('nav');
  const organizationLd = { '@type': 'Organization', name: 'מכון קרן רא״ם', url: siteUrl };

  const breadcrumbItems = [
    { name: nav('home'), url: siteUrl + localePrefix },
    { name: nav('books'), url: `${siteUrl}${localePrefix}/books` },
    ...(categoryName && categoryHref ? [{ name: categoryName, url: `${siteUrl}${localePrefix}${categoryHref}` }] : []),
    { name: title, url: canonicalUrl },
  ];

  // Product/Offer רק כשהחנות פעילה והספר ניתן לרכישה בפועל: סימון מחיר
  // וזמינות על ספר שלא ניתן לקנות הוא בדיוק ההבדל שגוגל מציינת בין
  // Product Snippet רגיל לבין Merchant Listing (סעיף 32 במפרט).
  const productLd = showBuy
    ? {
        '@type': 'Product',
        name: title,
        ...(book.cover_image_url ? { image: book.cover_image_url } : {}),
        ...(book.sku ? { sku: book.sku } : {}),
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          priceCurrency: book.currency ?? 'ILS',
          // המחיר בתוקף — מבצע פעיל גובר על הרגיל, מאותה פונקציה שמזינה את התצוגה
          price: effectivePrice?.amount ?? book.price,
          availability:
            availability === 'preorder'
              ? 'https://schema.org/PreOrder'
              : availability === 'in_stock'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
        },
      }
    : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      organizationLd,
      {
        '@type': 'Book',
        '@id': `${canonicalUrl}#book`,
        name: title,
        url: canonicalUrl,
        ...(authorDisplay ? { author: { '@type': 'Person', name: authorDisplay.name } } : {}),
        ...(book.isbn ? { isbn: book.isbn } : {}),
        ...(book.sku ? { sku: book.sku } : {}),
        ...(book.pages ? { numberOfPages: book.pages } : {}),
        ...(book.publication_year_ce ? { datePublished: String(book.publication_year_ce) } : {}),
        ...(book.cover_image_url ? { image: book.cover_image_url } : {}),
        inLanguage: 'he',
        publisher: organizationLd,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      },
      ...(productLd ? [productLd] : []),
    ],
  };

  // החלפת < מנטרלת סגירת </script> מתוך ערכי תוכן (שם ספר/תיאור שעורך
  // הקליד) — הדפוס המקובל להזרקת JSON-LD בטוחה לתוך תגית script.
  const jsonLdMarkup = JSON.stringify(jsonLd).replaceAll('<', '\\u003c');

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdMarkup }} />

      <ViewTracker slug={book.slug} />

      <BookBreadcrumbs categoryName={categoryName} categoryHref={categoryHref} title={title} />

      <BookHero
        book={book}
        palette={palette}
        title={title}
        subtitle={subtitle}
        author={authorDisplay}
        categoryName={categoryName}
        year={year}
        badges={badges}
        locale={locale}
        actions={
          <BookHeroActions
            bookId={book.id}
            title={title}
            price={formattedPrice}
            availability={availability}
            preorderDate={formattedPreorderDate}
            externalSupplier={externalSupplier}
          />
        }
        t={tValues}
      />

      <StickyNav sections={sections} title={title} price={formattedPrice} />

      <Container className="space-y-[var(--space-section)] py-16 lg:py-24">
        {/* התקציר והדפדוף זה לצד זה, ביחס א-סימטרי (5/7, סעיף 14 במפרט)
            ולא שתי עמודות שוות — שניהם עונים על "מה יש בספר הזה", ומי
            שמעדיף לראות דף אמיתי על פני תיאור לא צריך לגלול בשבילו.
            בלי דפדוף אין שתי עמודות בכלל — כרטיס יחיד בחצי רוחב היה
            משאיר חצי מסך ריק לצדו. */}
        <div
          className={`grid grid-cols-1 items-start gap-6 ${showInlineSample ? 'lg:grid-cols-[5fr_7fr]' : ''}`}
        >
          {showInlineSample ? (
            <section
              aria-labelledby="book-sample"
              className="rounded-[var(--radius-lg)] border border-rule bg-cream px-7 py-8 shadow-[var(--shadow-soft)] sm:px-9 sm:py-10"
            >
              <h2 id="book-sample" className="mb-4 font-serif text-h3 text-ink">
                {t('readSample')}
              </h2>
              <BookSampleViewer pdfUrl={toCdnUrl(book.sample_pdf_url!)} title={title} locale={locale} />
            </section>
          ) : null}

          <section
            id="book-summary"
            aria-labelledby="book-summary-heading"
            className="rounded-[var(--radius-lg)] border border-rule bg-cream px-7 py-8 shadow-[var(--shadow-soft)] sm:px-9 sm:py-10"
          >
            <h2 id="book-summary-heading" className="mb-4 font-serif text-h3 text-ink">
              {t('navSummary')}
            </h2>
            {description ? (
              <SummaryCard html={description} brief={descriptionBrief} />
            ) : (
              <p className="text-small text-muted">{t('noSummary')}</p>
            )}

            {spec.length > 0 ? (
              <div className="mt-8 border-t border-rule pt-7">
                <SpecGrid items={spec} />
              </div>
            ) : null}
          </section>
        </div>

        {/* הדפדוף המוחשי מקבל רוחב מלא ולא חצי עמודה: זו פתיחה של ספר,
            spread של שני עמודים, ולא כרטיס מידע. מוצג רק כשיש דפים
            שהומרו מראש בניהול — בלי דפים אין כאן אזור בכלל, וה-PDF
            מוצג במקומו ככרטיס לצד התקציר (ראו showInlineSample). */}
        {previewPages.length > 0 ? (
          <section id="book-sample" aria-labelledby="book-sample-heading">
            <h2 id="book-sample-heading" className="mb-6 font-serif text-h2 text-ink">
              {t('readSample')}
            </h2>
            <BookFlipViewer
              pages={previewPages.map((page) => ({
                id: page.id,
                imageUrl: toCdnUrl(page.image_url),
                pageNumber: page.page_number,
              }))}
              title={title}
              pdfUrl={book.sample_pdf_url ? toCdnUrl(book.sample_pdf_url) : book.sample_pdf_url}
              locale={locale}
            />
          </section>
        ) : null}

        {book.quotes.length > 0 ? <QuoteCards quotes={book.quotes} t={t} /> : null}

        {book.toc && book.toc.length > 0 ? <TableOfContents entries={book.toc} /> : null}

        {hasKnowledgeSpace ? (
          <KnowledgeSpace tags={book.tags ?? []} locale={locale} title={t('navKnowledge')} />
        ) : null}

        {book.images && book.images.length > 0 ? (
          <Gallery images={book.images} title={title} t={tValues} />
        ) : null}

        {/* מחבר וסדרה זה לצד זה: שניהם עונים על "מאיפה הספר הזה בא",
            ובמסך רחב אין סיבה להפוך אותם לשתי גלילות נפרדות. */}
        {author || (book.series && connections.sameSeries.length > 0) ? (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            {author ? (
              <AuthorSection
                author={author}
                authorName={authorDisplay?.name ?? author.name_he}
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
          </div>
        ) : null}

        {hasConnections ? (
          <ConnectionsSection connections={connections} authorName={authorDisplay?.name ?? null} locale={locale} />
        ) : null}
      </Container>

      <FloatingActions
        bookId={book.id}
        title={title}
        price={formattedPrice}
        showBuy={showBuy}
        availability={availability}
      />

      {/* [1.30] דיווח על הספר — צף מעל לחצן הנגישות, מוביל לטופס ההערות
          על ספרים כשהספר הזה כבר נבחר בפנייה. */}
      <ReportBookButton bookId={book.id} label={t('reportBook')} />
    </>
  );
}
