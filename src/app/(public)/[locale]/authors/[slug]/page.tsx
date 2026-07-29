import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { BookGrid } from '@/components/BookGrid';
import { RichText } from '@/components/RichText';
import { SectionHeading } from '@/components/SectionHeading';
import { getAuthorBySlug, getAuthorSlugs, getBooksByAuthor } from '@/lib/data';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/sanitize';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;
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
  const { locale, slug } = await params;
  const author = await getAuthorBySlug(slug);
  if (!author) return {};

  const name = localized(author, 'name', locale);
  return {
    title: name,
    description: htmlToPlainText(localized(author, 'bio', locale), 160) || name,
  };
}

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const t = await getTranslations('authors');
  const books = await getBooksByAuthor(author.id);
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
      </article>

      {books.length > 0 ? (
        <section className="mt-16">
          <SectionHeading title={t('booksHeading')} />
          <BookGrid books={books} locale={locale} />
        </section>
      ) : null}
    </Container>
  );
}
