import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { BookCatalogue } from '@/components/BookCatalogue';
import { getAuthors, getBooks, getCategories } from '@/lib/data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'books' });
  return { title: t('title'), description: t('intro') };
}

export default async function BooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ locale }, { q }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const t = await getTranslations('books');
  const [books, categories, authors] = await Promise.all([getBooks(), getCategories(), getAuthors()]);

  // מסננים רק מחברים שיש להם ספר בקטלוג — רשימה נפתחת של שמות ללא ספרים
  // מטעה את המשתמש.
  const authorsWithBooks = authors.filter((author) =>
    books.some((book) => book.author_id === author.id),
  );

  return (
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />

      <div className="mt-12">
        <BookCatalogue
          books={books}
          categories={categories}
          authors={authorsWithBooks}
          locale={locale}
          initialQuery={q ?? ''}
        />
      </div>
    </Container>
  );
}
