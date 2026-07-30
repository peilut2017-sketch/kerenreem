import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { localized } from '@/lib/localized';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * קרוסלה אופקית של ספרים — לא רשת שנשברת לשורות. משמשת את כל קטעי
 * "ספרים קשורים": כל קרוסלה כזו מייצגת סיבת קשר אחת (מחבר, קטגוריה,
 * תגיות), ולכן היא מוצגת בנפרד מהשכנות שלה ולא מוזגת לרשימה אחת.
 */
export function BookCarousel({
  books,
  locale,
  coverAltFor,
}: {
  books: BookWithRelations[];
  locale: string;
  coverAltFor: (title: string) => string;
}) {
  if (books.length === 0) return null;

  return (
    <ul className="flex gap-5 overflow-x-auto pb-2">
      {books.map((book) => {
        const title = localized(book, 'title', locale);
        return (
          <li key={book.id} className="w-32 shrink-0 sm:w-40">
            <Link href={`/books/${book.slug}`} className="group block focus-visible:outline-offset-4">
              <div className="transition-transform duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1">
                <BookCover src={book.cover_image_url} title={title} alt={coverAltFor(title)} sizes="160px" />
              </div>
              <h3 className="mt-3 line-clamp-2 text-small leading-snug text-ink group-hover:text-burgundy">
                {title}
              </h3>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
