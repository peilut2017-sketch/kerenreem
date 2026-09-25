import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Catalogue } from '@/components/books/Catalogue';
import { getAuthors, getAttributes, getBooks, getCategories, getTags } from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { pageAlternates } from '@/lib/seo';
import { htmlToPlainText } from '@/lib/html-text';

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

export function generateStaticParams() {
  return [{ locale: 'he' }, { locale: 'en' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'books' });
  return { title: t('title'), description: t('heroSubtitle'), alternates: pageAlternates(locale, '/books') };
}

/**
 * בכוונה בלי searchParams: עצם הקריאה להם בעמוד שרת הופכת את המסלול
 * לדינמי בכל בקשה — כלומר revalidate=60 למעלה היה מת, וכל בקשה ל-/books
 * (העמוד הכבד באתר) הריצה את כל שש השליפות מחדש. פרמטרי הסינון נקראים
 * בצד הלקוח בתוך Catalogue (ראו שם) — אותה התנהגות למשתמש, עמוד סטטי.
 */
export default async function BooksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
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
  // Set ולא books.some בתוך filter — הצורה הישנה הייתה O(מחברים×ספרים).
  const authorIdsWithBooks = new Set(books.map((book) => book.author_id).filter(Boolean));
  const authorsWithBooks = authors.filter((author) => authorIdsWithBooks.has(author.id));
  // [1.21] לפי כל הקטגוריות של הספר, לא רק הראשית — אחרת קטגוריה
  // שמופיעה רק כמשנית על ספרים לא הייתה מוצעת כמסנן בכלל.
  const usedCategoryIds = new Set(books.flatMap((book) => (book.categories ?? []).map((category) => category.id)));
  const usedCategories = categories.filter((category) => usedCategoryIds.has(category.id));

  // רק תגיות שיש להן ספר: תגית שמובילה תמיד לאפס תוצאות מאריכה את
  // המגירה ומטעה.
  const usedTagSlugs = new Set(books.flatMap((book) => (book.tags ?? []).map((tag) => tag.slug)));
  const usedTags = tags.filter((tag) => usedTagSlugs.has(tag.slug));

  // הקטלוג הוא רכיב לקוח, וכל הספרים נשלחים אליו ב-RSC payload. ה-HTML
  // המלא של התיאור (העורך העשיר) משמש שם רק כטקסט לחיפוש — לכן הוא
  // מומר כאן לטקסט קצוץ: ~2KB HTML לספר ⇒ מאות KB שהרשת לא צריכה.
  const catalogueBooks = books.map((book) => ({
    ...book,
    description_he: book.description_he ? htmlToPlainText(book.description_he, 1200) : book.description_he,
    description_en: book.description_en ? htmlToPlainText(book.description_en, 1200) : book.description_en,
  }));

  return (
    <div className="pb-20">
      <Catalogue
        books={catalogueBooks}
        categories={usedCategories}
        authors={authorsWithBooks}
        tags={usedTags}
        attributes={attributes}
        locale={locale}
        storeEnabled={flags.showPrices}
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
