'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { Drawer } from './Drawer';
import { Img } from './Img';
import { globalSearch, type GlobalSearchResult } from '@/lib/search-actions';

const EMPTY: GlobalSearchResult = { books: [], totalBooks: 0, authors: [], categories: [] };
const DEBOUNCE_MS = 250;

interface FlatItem {
  href: string;
  key: string;
}

/**
 * [1.4] דיאלוג חיפוש גלובלי אמיתי (ב.2 בביקורת המימוש) — מחליף שדה
 * w-48 שרק ניווט ל-/books?q=… בלי אף תוצאה חיה. תוצאות מקובצות
 * (ספרים עם כריכה/מחבר/מחיר/זמינות, מחברים, קטגוריות) מ-Server Action,
 * בחירה מנווטת ישירות ליעד, ו"כל התוצאות" מוביל לקטלוג המסונן.
 * בנוי על Drawer variant="center" הקיים — לכידת מיקוד ו-Escape כבר שם.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('books');
  const locale = useLocale();
  const router = useRouter();
  const titleId = useId();
  const [value, setValue] = useState('');
  const [result, setResult] = useState<GlobalSearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const requestId = useRef(0);

  useEffect(() => {
    const query = value.trim();
    // אין שאילתה — אין מה לשלוף; ה-render כבר לא מציג תוצאות ישנות
    // כש-hasQuery הוא false, כך שאין צורך לאפס את result/loading כאן.
    if (!query) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      // setLoading בתוך ה-callback המתוזמן, לא בגוף האפקט עצמו — גם
      // עומד בכלל set-state-in-effect וגם לא מהבהב "מחפש…" על כל הקשה
      // בזמן ה-debounce עצמו, רק אחרי שהוא עומד לשלוח בקשה בפועל.
      setLoading(true);
      globalSearch(query, locale).then((data) => {
        if (requestId.current !== id) return; // תשובה ישנה — התעלמות, מונע הבהוב תוצאות
        setResult(data);
        setLoading(false);
        setActive(-1);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, locale]);

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const book of result.books) items.push({ href: `/books/${book.slug}`, key: `book-${book.slug}` });
    for (const author of result.authors) items.push({ href: `/authors/${author.slug}`, key: `author-${author.slug}` });
    for (const category of result.categories) {
      items.push({ href: `/books?category=${category.slug}`, key: `category-${category.slug}` });
    }
    return items;
  }, [result]);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flatItems.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % flatItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      go(flatItems[active].href);
    }
  }

  const hasQuery = value.trim().length > 0;
  const hasResults = result.books.length > 0 || result.authors.length > 0 || result.categories.length > 0;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      titleId={titleId}
      title={t('searchDialogTitle')}
      variant="center"
      widthClassName="max-w-xl"
      closeLabel={t('clearSearch')}
    >
      <div className="relative">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" fill="none">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          autoFocus
          role="combobox"
          aria-expanded={hasResults}
          aria-controls={`${titleId}-list`}
          aria-activedescendant={active >= 0 ? `${titleId}-option-${active}` : undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-[var(--radius-pill)] border border-rule bg-cream-2/60 py-3 ps-9 pe-4 text-body text-ink outline-none transition-colors focus:border-gold-deep"
        />
      </div>

      <div id={`${titleId}-list`} role="listbox" aria-label={t('searchDialogTitle')} className="mt-4 space-y-5">
        {!hasQuery ? null : loading ? (
          <p className="py-6 text-center text-small text-muted">{t('searchLoading')}</p>
        ) : !hasResults ? (
          <p className="py-6 text-center text-small text-muted">{t('searchNoResults', { query: value.trim() })}</p>
        ) : (
          <>
            {result.books.length > 0 ? (
              <ResultGroup label={t('searchGroupBooks')}>
                {result.books.map((book) => {
                  const index = flatItems.findIndex((item) => item.key === `book-${book.slug}`);
                  return (
                    <li key={book.slug} id={`${titleId}-option-${index}`} role="option" aria-selected={index === active}>
                      <Link
                        href={`/books/${book.slug}`}
                        onClick={onClose}
                        onMouseEnter={() => setActive(index)}
                        className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2 transition-colors ${
                          index === active ? 'bg-cream-2' : 'hover:bg-cream-2/60'
                        }`}
                      >
                        <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-cream-2">
                          {book.cover ? (
                            <Img src={book.cover} alt="" fill sizes="40px" className="object-contain" />
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-serif text-small text-ink">{book.title}</span>
                          {book.author ? (
                            <span className="block truncate text-caption text-muted">{book.author}</span>
                          ) : null}
                        </span>
                        {book.price ? (
                          <span className="shrink-0 text-caption tabular-nums text-ink-soft">
                            {book.availability === 'out_of_stock' ? t('outOfStock') : book.price}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ResultGroup>
            ) : null}

            {result.authors.length > 0 ? (
              <ResultGroup label={t('searchGroupAuthors')}>
                {result.authors.map((author) => {
                  const index = flatItems.findIndex((item) => item.key === `author-${author.slug}`);
                  return (
                    <li key={author.slug} id={`${titleId}-option-${index}`} role="option" aria-selected={index === active}>
                      <Link
                        href={`/authors/${author.slug}`}
                        onClick={onClose}
                        onMouseEnter={() => setActive(index)}
                        className={`block rounded-[var(--radius-md)] px-3 py-2 text-small text-ink transition-colors ${
                          index === active ? 'bg-cream-2' : 'hover:bg-cream-2/60'
                        }`}
                      >
                        {author.name}
                      </Link>
                    </li>
                  );
                })}
              </ResultGroup>
            ) : null}

            {result.categories.length > 0 ? (
              <ResultGroup label={t('searchGroupCategories')}>
                {result.categories.map((category) => {
                  const index = flatItems.findIndex((item) => item.key === `category-${category.slug}`);
                  return (
                    <li key={category.slug} id={`${titleId}-option-${index}`} role="option" aria-selected={index === active}>
                      <Link
                        href={`/books?category=${category.slug}`}
                        onClick={onClose}
                        onMouseEnter={() => setActive(index)}
                        className={`block rounded-[var(--radius-md)] px-3 py-2 text-small text-ink transition-colors ${
                          index === active ? 'bg-cream-2' : 'hover:bg-cream-2/60'
                        }`}
                      >
                        {category.name}
                      </Link>
                    </li>
                  );
                })}
              </ResultGroup>
            ) : null}

            {result.totalBooks > result.books.length ? (
              <Link
                href={`/books?q=${encodeURIComponent(value.trim())}`}
                onClick={onClose}
                className="block rounded-[var(--radius-md)] px-3 py-2.5 text-center text-small font-semibold text-burgundy transition-colors hover:bg-cream-2/60"
              >
                {t('searchAllResults', { count: result.totalBooks })}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </Drawer>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-caption font-semibold text-muted">{label}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
