import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { getAuthors, getBooks } from '@/lib/data';
import { localized } from '@/lib/localized';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'authors' });
  return { title: t('title'), description: t('intro') };
}

export default async function AuthorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('authors');
  const [authors, books] = await Promise.all([getAuthors(), getBooks()]);

  const bookCounts = new Map<string, number>();
  for (const book of books) {
    if (book.author_id) bookCounts.set(book.author_id, (bookCounts.get(book.author_id) ?? 0) + 1);
  }

  return (
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="mt-12" />

      {authors.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        <ul className="border-t border-rule">
          {authors.map((author) => {
            const name = localized(author, 'name', locale);
            const years =
              author.birth_year || author.death_year
                ? t('years', { birth: author.birth_year ?? '', death: author.death_year ?? '' })
                : null;

            return (
              <li key={author.id} className="border-b border-rule">
                <Link
                  href={`/authors/${author.slug}`}
                  className="group flex items-center gap-5 py-5 focus-visible:outline-offset-4"
                >
                  {author.portrait_url ? (
                    <Image
                      src={author.portrait_url}
                      alt={t('portraitAlt', { name })}
                      width={56}
                      height={72}
                      sizes="56px"
                      className="h-18 w-14 shrink-0 border border-rule object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-18 w-14 shrink-0 items-center justify-center border border-rule bg-cream-2 font-serif text-[1.25rem] text-rule-strong"
                    >
                      {name.trim().charAt(0)}
                    </span>
                  )}

                  <span className="flex-1">
                    <span className="block font-serif text-h3 text-ink group-hover:text-burgundy">
                      {name}
                    </span>
                    {years ? <span className="mt-1 block text-small text-muted">{years}</span> : null}
                  </span>

                  <span className="hidden text-small text-muted sm:block">
                    {t('bookCount', { count: bookCounts.get(author.id) ?? 0 })}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Container>
  );
}
