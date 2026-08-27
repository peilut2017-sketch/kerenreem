'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchBar } from './SearchBar';
import { FilterDrawer } from './FilterDrawer';
import { Toolbar, type ViewMode } from './Toolbar';
import { BookCard } from './BookCard';
import { BookListRow } from './BookListRow';
import { BooksHero } from './BooksHero';
import { useLocalList } from '@/lib/client-hooks';
import { localized } from '@/lib/localized';
import { formatPrice } from '@/lib/commerce/pricing';
import {
  applyFilters,
  searchCorpus,
  sortBooks,
  EMPTY_FILTERS,
  countActiveFilters,
  type Filters,
  type SortKey,
} from '@/lib/book-search';
import type {
  AttributeWithValues,
  Author,
  BookWithRelations,
  Category,
  Series,
  Tag,
} from '@/lib/supabase/types';

type SeriesOption = Pick<Series, 'id' | 'slug' | 'name_he' | 'name_en'>;

/** שמות השפות לתצוגה. הרשימה סגורה וזהה לזו שבטופס הניהול. */
/** קוד שפה → מפתח תרגום. שם השפה עצמו מתורגם, אחרת מבקר אנגלי רואה "עברית". */
const LANGUAGE_KEYS: Record<string, string> = {
  he: 'langHe',
  en: 'langEn',
  yi: 'langYi',
  fr: 'langFr',
  ru: 'langRu',
  es: 'langEs',
};

const BATCH = 24;

/**
 * הקטלוג כולו.
 *
 * הרשימה המלאה מגיעה מהשרת ברינדור הראשוני — כך שהקטלוג נסרק במלואו
 * למנועי חיפוש — והסינון עצמו מיידי בצד הלקוח.
 *
 * מצב הסינון נכתב לכתובת ב-replaceState ולא דרך הנתב: כל שינוי מסנן דרך
 * הנתב הוא בקשת שרת, כלומר המתנה על כל הקשה. הכתובת נשארת ניתנת לשיתוף
 * ולרענון, וזו כל מטרתה כאן.
 */
export function Catalogue({
  books,
  categories,
  authors,
  tags,
  attributes,
  locale,
  storeEnabled,
  initial,
  labels,
}: {
  books: BookWithRelations[];
  categories: Category[];
  authors: Author[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  locale: string;
  storeEnabled: boolean;
  initial: { query: string; category: string; sort: SortKey; page: number };
  labels: {
    title: string;
    subtitle: string;
    searchLabel: string;
    searchPlaceholder: string;
    countLabel: string;
    empty: string;
    emptyCatalogue: string;
    clear: string;
  };
}) {
  const t = useTranslations('books');
  const [filters, setFilters] = useState<Filters>({
    ...EMPTY_FILTERS,
    query: initial.query,
    category: initial.category,
  });
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [view, setView] = useState<ViewMode>('grid');
  const [visible, setVisible] = useState(Math.max(initial.page, 1) * BATCH);
  const [toast, setToast] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { list: favouriteIds, toggle } = useLocalList('kr:favourites');
  const favourites = useMemo(() => new Set(favouriteIds), [favouriteIds]);
  const deferredFilters = useDeferredValue(filters);

  /**
   * שינוי סינון מאפס את העימוד.
   *
   * זה נעשה כאן ולא ב-useEffect: איפוס באפקט הוא רינדור שני מיד אחרי
   * הראשון, שבו מוצגות עדיין תוצאות מהסינון הקודם. הסינון והעימוד משתנים
   * יחד באותה פעולה, ולכן הם נקבעים יחד.
   */
  const changeFilters = useCallback((next: Filters | ((current: Filters) => Filters)) => {
    setFilters(next);
    setVisible(BATCH);
  }, []);

  const changeSort = useCallback((next: SortKey) => {
    setSort(next);
    setVisible(BATCH);
  }, []);

  // המאגר נבנה פעם אחת לכל ספר; בלעדיו כל הקשה הייתה מנקה מחדש את כל
  // תיאורי ה-HTML בקטלוג
  const corpora = useMemo(
    () => new Map(books.map((book) => [book.id, searchCorpus(book)])),
    [books],
  );

  // מזהה ערך → המאפיין שאליו הוא שייך. נדרש כדי שערכים של אותו מאפיין
  // יתנהגו כאיחוד ובין מאפיינים שונים כחיתוך.
  const attributeOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const attribute of attributes) {
      for (const value of attribute.values) map.set(value.id, attribute.id);
    }
    return map;
  }, [attributes]);

  const results = useMemo(
    () => sortBooks(applyFilters(books, deferredFilters, corpora, favourites, attributeOf), sort),
    [books, deferredFilters, corpora, favourites, attributeOf, sort],
  );

  // רק שפות שקיימות בפועל בקטלוג — מסנן שמוביל תמיד לאפס מטעה
  const languages = useMemo(() => {
    const present = new Set(books.flatMap((book) => book.languages ?? []));
    return [...present]
      .filter((code) => LANGUAGE_KEYS[code])
      .map((code) => ({ code, label: t(LANGUAGE_KEYS[code]) }));
  }, [books, t]);

  // הכתובת משקפת את המצב, כדי שאפשר יהיה לשתף ולרענן
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.category) params.set('category', filters.category);
    if (sort !== 'recommended') params.set('sort', sort);
    const page = Math.ceil(visible / BATCH);
    if (page > 1) params.set('page', String(page));

    const search = params.toString();
    window.history.replaceState(null, '', search ? `?${search}` : window.location.pathname);
  }, [filters.query, filters.category, sort, visible]);

  const onToggleFavourite = useCallback(
    (book: BookWithRelations) => {
      const added = toggle(book.id);
      setToast(
        added
          ? t('favouriteAdded', { title: localized(book, 'title', locale) })
          : t('favouriteRemoved'),
      );
    },
    [toggle, locale, t],
  );

  // ההודעה נעלמת מעצמה, אבל היא אינה הדרך היחידה לדעת מה קרה: מצב הלב
  // עצמו מוסר דרך aria-pressed בכל רגע
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const bindings = useMemo(
    () => [...new Set(books.map((book) => book.binding).filter((x): x is string => Boolean(x)))].sort(),
    [books],
  );

  // [1.6] מסנן סדרה (ח.17) — רק סדרות שיש להן כרגע ספר מפורסם בקטלוג,
  // אותו עיקרון בדיוק כמו bindings/languages למעלה
  const seriesOptions = useMemo(() => {
    const map = new Map<string, SeriesOption>();
    for (const book of books) {
      if (book.series) map.set(book.series.slug, book.series);
    }
    return [...map.values()];
  }, [books]);

  const years = useMemo(() => {
    const list = books
      .map((book) => book.publication_year_ce)
      .filter((year): year is number => typeof year === 'number');
    return list.length ? { min: Math.min(...list), max: Math.max(...list) } : null;
  }, [books]);

  const maxPrice = useMemo(() => {
    const list = books.map((book) => Number(book.price)).filter((price) => Number.isFinite(price));
    return list.length ? Math.ceil(Math.max(...list) / 10) * 10 : null;
  }, [books]);

  const shown = results.slice(0, visible);
  const hasFilters = Boolean(filters.query || filters.category) || countActiveFilters(filters) > 0;
  const hasMore = visible < results.length;

  /**
   * [1.32] טעינה אוטומטית בגלילה במקום כפתור "טען עוד". הרשימה כולה כבר
   * בזיכרון (books הגיע מלא מהשרת) — "הטעינה" היא רק חשיפת עוד פריטים
   * מ-results, ולכן יש כאן עיכוב מכוון (350ms) כדי שאייקון הטעינה יספיק
   * להיראות ולתת משוב אמיתי, ולא רק להבהב פריים אחד. rootMargin עם שוליים
   * גדולים למעלה טוען מראש לפני שהתחתית ממש נראית, כדי שהגלילה לא תיעצר
   * ותחכה. בלי גלילה אינסופית מדומה: hasMore הופך false בפועל כשכל
   * התוצאות מוצגות, ואז התחתית (פוטר) נגישה כרגיל בלי לרדוף אחרי תוכן
   * חדש שמתווסף.
   */
  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
        window.setTimeout(() => {
          setVisible((n) => n + BATCH);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }, 350);
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <>
      <BooksHero title={labels.title} subtitle={labels.subtitle}>
        <div className="mx-auto max-w-[42rem]">
          <SearchBar
            value={filters.query}
            onChange={(query) => changeFilters((current) => ({ ...current, query }))}
            books={books}
            authors={authors}
            categories={categories}
            corpora={corpora}
            locale={locale}
            label={labels.searchLabel}
            placeholder={labels.searchPlaceholder}
          />
        </div>
      </BooksHero>

      <div className="mx-auto w-full max-w-[82rem] px-5 pt-12 sm:px-8">
      {categories.length > 0 ? (
        <ul className="mb-8 flex flex-wrap justify-center gap-2">
          <Chip
            label={t('allCategoriesChip')}
            selected={!filters.category}
            onSelect={() => changeFilters((current) => ({ ...current, category: '' }))}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={localized(category, 'name', locale)}
              selected={filters.category === category.slug}
              onSelect={() =>
                changeFilters((current) => ({
                  ...current,
                  category: current.category === category.slug ? '' : category.slug,
                }))
              }
            />
          ))}
        </ul>
      ) : null}

      <Toolbar
        count={results.length}
        countLabel={labels.countLabel}
        sort={sort}
        onSortChange={changeSort}
        view={view}
        onViewChange={setView}
        storeEnabled={storeEnabled}
        filterSlot={
          <FilterDrawer
            filters={filters}
            onChange={changeFilters}
            authors={authors}
            bindings={bindings}
            tags={tags}
            series={seriesOptions}
            attributes={attributes}
            languages={languages}
            years={years}
            locale={locale}
            storeEnabled={storeEnabled}
            maxPrice={maxPrice}
          />
        }
      />

      <ActiveFilterChips
        filters={filters}
        authors={authors}
        tags={tags}
        seriesOptions={seriesOptions}
        attributes={attributes}
        languages={languages}
        locale={locale}
        onChange={changeFilters}
      />

      {shown.length > 0 ? (
        view === 'list' ? (
          <ul className="space-y-4">
            {shown.map((book) => (
              <li key={book.id}>
                <BookListRow
                  book={book}
                  locale={locale}
                  isFavourite={favourites.has(book.id)}
                  onToggleFavourite={onToggleFavourite}
                  storeEnabled={storeEnabled}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul
            className={`grid gap-6 ${
              view === 'large'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'
            }`}
          >
            {shown.map((book, index) => (
              <li key={book.id}>
                <BookCard
                  book={book}
                  locale={locale}
                  priority={index < 5}
                  isFavourite={favourites.has(book.id)}
                  onToggleFavourite={onToggleFavourite}
                  storeEnabled={storeEnabled}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
        <EmptyState
          message={books.length === 0 ? labels.emptyCatalogue : labels.empty}
          onClear={hasFilters ? () => changeFilters(EMPTY_FILTERS) : undefined}
          clearLabel={labels.clear}
        />
      )}

      {hasMore ? (
        <div ref={sentinelRef} className="mt-12 flex h-16 items-center justify-center">
          {loadingMore ? (
            <>
              <BookFlipIcon />
              <span className="sr-only" aria-live="polite">
                {t('loadingMore')}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
        {toast ? (
          <p className="glass rounded-[var(--radius-pill)] px-5 py-2.5 text-small text-ink shadow-[var(--shadow-float)]">
            {toast}
          </p>
        ) : null}
      </div>
    </>
  );
}

function Chip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`rounded-[var(--radius-pill)] px-4 py-2 text-small transition-[background-color,color,transform] duration-300 ease-[var(--ease-spring)] active:scale-95 motion-reduce:transition-none ${
          selected
            ? 'bg-burgundy text-white'
            : 'glass text-ink-soft hover:text-burgundy'
        }`}
      >
        {label}
      </button>
    </li>
  );
}

/**
 * [1.6] שבבי מסנן פעילים (ח.17) — לעומת תג הספירה על כפתור הסינון,
 * כל שבב כאן ניתן להסרה עצמאית בלי לפתוח את המגירה מחדש. לא כולל את
 * קטגוריית-העל (הצ'יפים למעלה) ואת query — לשניהם כבר יש דרך משלהם
 * להתאפס (בחירת "הכול", ניקוי שדה החיפוש).
 */
function ActiveFilterChips({
  filters,
  authors,
  tags,
  seriesOptions,
  attributes,
  languages,
  locale,
  onChange,
}: {
  filters: Filters;
  authors: Author[];
  tags: Tag[];
  seriesOptions: SeriesOption[];
  attributes: AttributeWithValues[];
  languages: { code: string; label: string }[];
  locale: string;
  onChange: (next: Filters) => void;
}) {
  const t = useTranslations('books');
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  for (const slug of filters.authors) {
    const author = authors.find((a) => a.slug === slug);
    if (!author) continue;
    chips.push({
      key: `author-${slug}`,
      label: localized(author, 'name', locale),
      onRemove: () => onChange({ ...filters, authors: filters.authors.filter((s) => s !== slug) }),
    });
  }
  for (const slug of filters.tags) {
    const tag = tags.find((item) => item.slug === slug);
    if (!tag) continue;
    chips.push({
      key: `tag-${slug}`,
      label: localized(tag, 'name', locale),
      onRemove: () => onChange({ ...filters, tags: filters.tags.filter((s) => s !== slug) }),
    });
  }
  for (const slug of filters.series) {
    const item = seriesOptions.find((option) => option.slug === slug);
    if (!item) continue;
    chips.push({
      key: `series-${slug}`,
      label: localized(item, 'name', locale),
      onRemove: () => onChange({ ...filters, series: filters.series.filter((s) => s !== slug) }),
    });
  }
  for (const id of filters.attributeValues) {
    const value = attributes.flatMap((attribute) => attribute.values).find((v) => v.id === id);
    if (!value) continue;
    chips.push({
      key: `attr-${id}`,
      label: localized(value, 'name', locale),
      onRemove: () =>
        onChange({ ...filters, attributeValues: filters.attributeValues.filter((v) => v !== id) }),
    });
  }
  for (const code of filters.languages) {
    const language = languages.find((item) => item.code === code);
    chips.push({
      key: `lang-${code}`,
      label: language?.label ?? code,
      onRemove: () => onChange({ ...filters, languages: filters.languages.filter((c) => c !== code) }),
    });
  }
  for (const binding of filters.bindings) {
    chips.push({
      key: `binding-${binding}`,
      label: binding,
      onRemove: () => onChange({ ...filters, bindings: filters.bindings.filter((b) => b !== binding) }),
    });
  }
  if (filters.yearFrom !== null || filters.yearTo !== null) {
    chips.push({
      key: 'year',
      label:
        filters.yearFrom !== null && filters.yearTo !== null
          ? `${filters.yearFrom}–${filters.yearTo}`
          : String(filters.yearFrom ?? filters.yearTo),
      onRemove: () => onChange({ ...filters, yearFrom: null, yearTo: null }),
    });
  }
  if (filters.priceMax !== null) {
    chips.push({
      key: 'price',
      label: `${t('filterPriceUpTo')} ${formatPrice(filters.priceMax, locale)}`,
      onRemove: () => onChange({ ...filters, priceMax: null }),
    });
  }
  if (filters.multiVolume) {
    chips.push({ key: 'multi', label: t('filterMultiVolume'), onRemove: () => onChange({ ...filters, multiVolume: false }) });
  }
  if (filters.withSample) {
    chips.push({ key: 'sample', label: t('filterWithSample'), onRemove: () => onChange({ ...filters, withSample: false }) });
  }
  if (filters.purchasableOnly) {
    chips.push({
      key: 'purchasable',
      label: t('filterPurchasable'),
      onRemove: () => onChange({ ...filters, purchasableOnly: false }),
    });
  }
  if (filters.favouritesOnly) {
    chips.push({
      key: 'favourites',
      label: t('filterFavourites'),
      onRemove: () => onChange({ ...filters, favouritesOnly: false }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <ul className="mb-6 flex flex-wrap items-center gap-2" aria-label={t('filterActiveChips')}>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            onClick={chip.onRemove}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-burgundy/25 bg-burgundy/[0.06] px-3 py-1.5 text-caption text-burgundy transition-colors hover:bg-burgundy/15"
          >
            {chip.label}
            <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="m4 4 8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query, category: filters.category })}
          className="text-caption text-muted underline underline-offset-2 hover:text-burgundy"
        >
          {t('filterClear')}
        </button>
      </li>
    </ul>
  );
}

/** [1.32] סימן הטעינה של הגלילה האינסופית — ספר פתוח עם דפים מתהפכים (ראו .book-flip-page ב-globals.css). */
function BookFlipIcon() {
  return (
    <svg viewBox="0 0 40 30" aria-hidden="true" className="h-8 w-10 text-burgundy">
      <path d="M20 5 4 9v16l16 4z" fill="var(--color-cream-2)" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      <path d="M20 5 36 9v16l-16 4z" fill="var(--color-cream-2)" stroke="currentColor" strokeOpacity=".35" strokeWidth="1" />
      <path className="book-flip-page book-flip-page-2" d="M20 5 36 9v16l-16 4z" fill="var(--color-gold)" />
      <path className="book-flip-page" d="M20 5 36 9v16l-16 4z" fill="currentColor" />
    </svg>
  );
}

function EmptyState({
  message,
  onClear,
  clearLabel,
}: {
  message: string;
  onClear?: () => void;
  clearLabel: string;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-20 text-center">
      <svg viewBox="0 0 64 64" aria-hidden="true" className="h-16 w-16 text-rule" fill="none">
        <path
          d="M14 12h20a4 4 0 0 1 4 4v36l-14-7-14 7V16a4 4 0 0 1 4-4Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="44" cy="26" r="11" stroke="currentColor" strokeWidth="2" />
        <path d="m52 34 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>

      <p className="mt-6 max-w-[38ch] text-body text-ink-soft">{message}</p>

      {onClear ? (
        <button type="button" onClick={onClear} className="btn btn-quiet mt-8">
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
