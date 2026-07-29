import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookCover } from './BookCover';
import type { BookWithRelations } from '@/lib/supabase/types';
import { localized } from '@/lib/localized';

/**
 * מדף הספרים. שורות מופרדות בקו שיער — ציטוט של מדף ספרייה, ולא רשת
 * של כרטיסים עם צל. הכריכה נושאת את המשקל הוויזואלי; הטקסט מתחתיה שקט.
 *
 * הרכיב אינו async בכוונה, כדי שיוכל לשמש גם את הקטלוג המסונן בצד הלקוח
 * וגם עמודים שנרנדרים בשרת.
 */
export function BookGrid({
  books,
  locale,
  priorityCount = 0,
}: {
  books: BookWithRelations[];
  locale: string;
  priorityCount?: number;
}) {
  const t = useTranslations('books');

  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {books.map((book, index) => {
        const title = localized(book, 'title', locale);
        const authorName = book.author ? localized(book.author, 'name', locale) : null;

        return (
          <li key={book.id} className="border-b border-rule pb-6">
            <Link href={`/books/${book.slug}`} className="group block focus-visible:outline-offset-4">
              <BookCover
                src={book.cover_image_url}
                title={title}
                alt={t('coverAlt', { title })}
                priority={index < priorityCount}
              />
              <h3 className="mt-4 text-[1.0625rem] leading-snug text-ink group-hover:text-burgundy">
                {title}
              </h3>
              {authorName ? <p className="mt-1 text-small text-muted">{authorName}</p> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
