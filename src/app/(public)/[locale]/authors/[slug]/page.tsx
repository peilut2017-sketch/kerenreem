import type { Metadata } from 'next';
import { Img as Image } from '@/components/Img';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { BookCardGrid } from '@/components/books/BookCardGrid';
import { RichText } from '@/components/RichText';
import { SectionHeading } from '@/components/SectionHeading';
import { getAuthorBySlug, getAuthorSlugs, getBooksByAuthor } from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';
import { pageAlternates } from '@/lib/seo';
import { toCdnUrl } from '@/lib/image-src';

/*
 * ‏[1.42] סטטי + on-demand בלבד. אין כאן revalidate מבוסס-זמן.
 *
 * העמוד מציג מחירים, ולכן הוא תלוי בחלונות המבצע
 * (‏sale_starts_at/sale_ends_at, ראו commerce/pricing.ts) — מעברים שקורים
 * לפי שעון בלי ששום שורה במסד משתנה. עד כה זה נפתר בכך שהעמוד נכתב
 * מחדש בכל דקה, לנצח, כדי לתפוס מעבר שקורה פעם בשבוע.
 *
 * מעכשיו הגבולות האלה מטופלים ב-/api/cron/revalidate, שרץ כל 15 דקות,
 * **שואל** אם נחצה גבול, ומרענן נתיבים קונקרטיים בלבד — ולא נוגע בשום
 * מטמון כשלא נחצה. ראו lib/revalidation/boundaries.ts.
 *
 * זמינות המלאי אינה סיבה ל-ISR: היא נטענת בזמן אמת אחרי ה-hydration
 * (‏lib/books/availability-actions.ts), ולכן שריון, שחרור ותנועת מלאי
 * אינם מצריכים לרענן את העמוד כלל.
 *
 * שינויי תוכן (עריכת ספר, מחבר, באנר) מרעננים on-demand מאז ומתמיד —
 * ראו entity.revalidate ב-lib/admin/schema.ts.
 */
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAuthorSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  // [1.9] כתובת בעברית מגיעה מ-Next כאן עדיין percent-encoded — בלי
  // הפענוח ההשוואה למזהה השמור במסד (עברית רגילה) לעולם לא תואמת.
  const slug = decodeURIComponent(rawSlug);
  const author = await getAuthorBySlug(slug);
  if (!author) return {};

  const name = localized(author, 'name', locale);
  return {
    title: name,
    description: htmlToPlainText(localized(author, 'bio', locale), 160) || name,
    alternates: pageAlternates(locale, `/authors/${author.slug}`),
    openGraph: author.portrait_url
      ? { title: name, images: [{ url: toCdnUrl(author.portrait_url), alt: name }] }
      : undefined,
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);

  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const t = await getTranslations('authors');
  const [books, flags] = await Promise.all([getBooksByAuthor(author.id), getCommerceFlags()]);
  const name = localized(author, 'name', locale);
  const years =
    author.birth_year || author.death_year
      ? t('years', { birth: author.birth_year ?? '', death: author.death_year ?? '' })
      : null;

  return (
    <Container className="py-14">
      <article>
        <header className="grid gap-8 border-b border-rule pb-10 sm:grid-cols-[9rem_1fr] sm:gap-10">
          {author.portrait_url ? (
            <Image
              src={author.portrait_url}
              alt={t('portraitAlt', { name })}
              width={144}
              height={188}
              sizes="144px"
              className="w-36 border border-rule object-cover"
              priority
            />
          ) : (
            <span aria-hidden="true" className="hidden sm:block" />
          )}
          <div>
            <h1 className="text-h1 text-ink">{name}</h1>
            {years ? <p className="mt-2 text-lead text-muted">{years}</p> : null}
          </div>
        </header>

        <div className="mt-10">
          <RichText html={localized(author, 'bio', locale)} />
        </div>

        {/* ציר תולדות החיים ישב קודם בעמוד הספר. הוא הועבר לכאן: זהו
            מידע על המחבר ולא על הספר, ובעמוד הספר הוא דחק את שאר ספריו
            של המחבר מטה. */}
        {author.timeline.length > 0 ? (
          <section className="mt-14" aria-labelledby="author-timeline">
            <h2 id="author-timeline" className="eyebrow mb-5">
              {t('timelineHeading')}
            </h2>
            <ol className="flex gap-6 overflow-x-auto pb-1">
              {author.timeline.map((entry, index) => (
                <li key={index} className="relative min-w-32 shrink-0 border-t border-rule pt-3.5">
                  <span
                    aria-hidden="true"
                    className="absolute -top-[3px] start-0 h-[5px] w-[5px] rounded-full bg-gold-deep"
                  />
                  <div className="text-caption text-gold-deep">{entry.year}</div>
                  <div className="mt-1 text-small leading-snug text-ink-soft">{entry.text}</div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </article>

      {books.length > 0 ? (
        <section className="mt-16">
          <SectionHeading title={t('booksHeading')} />
          <BookCardGrid books={books} locale={locale} storeEnabled={flags.showPrices} />
        </section>
      ) : null}
    </Container>
  );
}
