import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
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

export default async function BooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('books');
  const [books, categories, authors] = await Promise.all([getBooks(), getCategories(), getAuthors()]);

  // מסננים רק מחברים שיש להם ספר בקטלוג — רשימה נפתחת של שמות ללא ספרים
  // מטעה את המשתמש.
  const authorsWithBooks = authors.filter((author) =>
    books.some((book) => book.author_id === author.id),
  );

  return (
    <Container className="py-14">
      <header className="mb-10 max-w-[52ch]">
        <h1 className="text-h1 text-ink">{t('title')}</h1>
        <p className="mt-3 text-lead text-muted">{t('intro')}</p>
      </header>

      <BookCatalogue
        books={books}
        categories={categories}
        authors={authorsWithBooks}
        locale={locale}
      />
    </Container>
  );
}
