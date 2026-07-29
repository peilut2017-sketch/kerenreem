'use client';

import { useDeferredValue, useId, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { BookGrid } from './BookGrid';
import { localized } from '@/lib/localized';
import type { Author, BookWithRelations, Category } from '@/lib/supabase/types';

/**
 * סינון הקטלוג. הרשימה כולה מגיעה מהשרת ברינדור הראשוני (טובה ל-SEO
 * ולטעינה), והסינון עצמו מיידי בצד הלקוח — קטלוג של מאות כותרים לא מצדיק
 * הלוך-ושוב לשרת על כל הקשה.
 */
export function BookCatalogue({
  books,
  categories,
  authors,
  locale,
  initialQuery = '',
}: {
  books: BookWithRelations[];
  categories: Category[];
  authors: Author[];
  locale: string;
  /** מגיע מ-?q= בכתובת, כדי שחיפוש מהכותרת יינחת עם הסינון כבר מוחל */
  initialQuery?: string;
}) {
  const t = useTranslations('books');
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('');
  const [author, setAuthor] = useState('');
  const deferredQuery = useDeferredValue(query);

  const searchId = useId();
  const categoryId = useId();
  const authorId = useId();

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return books.filter((book) => {
      if (category && book.category?.slug !== category) return false;
      if (author && book.author?.slug !== author) return false;
      if (!needle) return true;

      const haystack = [
        book.title_he,
        book.title_en,
        book.subtitle_he,
        book.subtitle_en,
        book.author?.name_he,
        book.author?.name_en,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [books, deferredQuery, category, author]);

  const hasFilters = Boolean(query || category || author);

  return (
    <>
      <div className="mb-10 border-y border-rule py-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto] lg:items-end">
          <div>
            <label htmlFor={searchId} className="field-label">
              {t('search')}
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="field-input"
            />
          </div>

          <div>
            <label htmlFor={categoryId} className="field-label">
              {t('filterCategory')}
            </label>
            <select
              id={categoryId}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="field-input"
            >
              <option value="">{t('allCategories')}</option>
              {categories.map((item) => (
                <option key={item.id} value={item.slug}>
                  {localized(item, 'name', locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={authorId} className="field-label">
              {t('filterAuthor')}
            </label>
            <select
              id={authorId}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              className="field-input"
            >
              <option value="">{t('allAuthors')}</option>
              {authors.map((item) => (
                <option key={item.id} value={item.slug}>
                  {localized(item, 'name', locale)}
                </option>
              ))}
            </select>
          </div>

          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('');
                setAuthor('');
              }}
              className="btn btn-quiet"
            >
              {t('clearFilters')}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
        </div>

        {/* מספר התוצאות מוכרז לקוראי מסך — אחרת הסינון "קורה בשקט".
            בקטלוג ריק אין מה למנות; ההודעה על הקמת הקטלוג מופיעה מתחת. */}
        {books.length > 0 ? (
          <p aria-live="polite" className="mt-4 text-caption text-muted">
            {t('resultCount', { count: filtered.length })}
          </p>
        ) : null}
      </div>

      {filtered.length > 0 ? (
        <BookGrid books={filtered} locale={locale} priorityCount={4} />
      ) : (
        <p className="py-10 text-muted">{books.length === 0 ? t('emptyCatalogue') : t('empty')}</p>
      )}
    </>
  );
}
