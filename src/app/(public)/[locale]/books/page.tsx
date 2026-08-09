import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Catalogue } from '@/components/books/Catalogue';
import { getAuthors, getAttributes, getBooks, getCategories, getTags } from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import type { SortKey } from '@/lib/book-search';

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
  const [books, categories, authors, tags, attributes, flags] = await Promise.all([
    getBooks(),
    getCategories(),
    getAuthors(),
    getTags(),
    getAttributes(),
    getCommerceFlags(),
  ]);

  // רק מחברים שיש להם ספר, ורק קטגוריות שיש בהן ספר: מסנן שמוביל תמיד
  // לאפס תוצאות מטעה את המשתמש ומאריך את המגירה לחינם.
  const authorsWithBooks = authors.filter((author) =>
    books.some((book) => book.author_id === author.id),
  );
  const usedCategories = categories.filter((category) =>
    books.some((book) => book.category_id === category.id),
  );

  // רק תגיות שיש להן ספר: תגית שמובילה תמיד לאפס תוצאות מאריכה את
  // המגירה ומטעה.
  const usedTagSlugs = new Set(books.flatMap((book) => (book.tags ?? []).map((tag) => tag.slug)));
  const usedTags = tags.filter((tag) => usedTagSlugs.has(tag.slug));

  const requestedSort = query.sort as SortKey | undefined;
  const page = Number(query.page);

  return (
    <div className="pb-20">
      <Catalogue
        books={books}
        categories={usedCategories}
        authors={authorsWithBooks}
        tags={usedTags}
        attributes={attributes}
        locale={locale}
        storeEnabled={flags.showPrices}
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
