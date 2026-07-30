import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Catalogue } from '@/components/books/Catalogue';
import { getAuthors, getBooks, getCategories, getSiteSettings } from '@/lib/data';
import type { SortKey } from '@/lib/book-search';

export const revalidate = 3600;

const SORTS: SortKey[] = ['recommended', 'newest', 'oldest', 'title', 'priceAsc', 'priceDesc'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'books' });
  return { title: t('title'), description: t('heroSubtitle') };
}

export default async function BooksPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; category?: string; sort?: string; page?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  const t = await getTranslations('books');
  const [books, categories, authors, settings] = await Promise.all([
    getBooks(),
    getCategories(),
    getAuthors(),
    getSiteSettings(),
  ]);

  // רק מחברים שיש להם ספר, ורק קטגוריות שיש בהן ספר: מסנן שמוביל תמיד
  // לאפס תוצאות מטעה את המשתמש ומאריך את המגירה לחינם.
  const authorsWithBooks = authors.filter((author) =>
    books.some((book) => book.author_id === author.id),
  );
  const usedCategories = categories.filter((category) =>
    books.some((book) => book.category_id === category.id),
  );

  const covers = books
    .map((book) => book.cover_image_url)
    .filter((url): url is string => Boolean(url))
    .slice(0, 5);

  const requestedSort = query.sort as SortKey | undefined;
  const page = Number(query.page);

  return (
    <div className="pt-3 pb-20">
      <Catalogue
        books={books}
        categories={usedCategories}
        authors={authorsWithBooks}
        locale={locale}
        storeEnabled={settings.store_enabled}
        covers={covers}
        initial={{
          query: query.q ?? '',
          category: query.category ?? '',
          sort: requestedSort && SORTS.includes(requestedSort) ? requestedSort : 'recommended',
          page: Number.isFinite(page) && page > 0 ? page : 1,
        }}
        labels={{
          title: t('title'),
          subtitle: t('heroSubtitle'),
          searchLabel: t('search'),
          searchPlaceholder: t('searchPlaceholder'),
          countLabel: t('countLabel'),
          empty: t('empty'),
          emptyCatalogue: t('emptyCatalogue'),
          clear: t('clearFilters'),
        }}
      />
    </div>
  );
}
