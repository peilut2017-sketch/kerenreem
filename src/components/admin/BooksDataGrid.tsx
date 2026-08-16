'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { bulkUpdateBooks } from '@/lib/admin/actions';
import { saveUserPref } from '@/lib/admin/prefs-actions';
import type { BookCompletionSignalIds, BookRow } from '@/lib/admin/queries';
import { computeCompletion, type CompletionSignals } from '@/lib/completion';
import { formatPrice } from '@/lib/commerce/pricing';
import { toCdnUrl } from '@/lib/image-src';
import { AdminIcon } from './AdminIcons';
import { CompletionBadge } from './CompletionBadge';
import { RowActions } from './RowActions';
import { Spinner } from './SubmitButton';

type ColumnId =
  | 'catalogue_number'
  | 'author'
  | 'year'
  | 'completion'
  | 'updated'
  | 'sku'
  | 'category'
  | 'price'
  | 'stock'
  | 'purchasable'
  | 'series'
  | 'publisher'
  | 'edition'
  | 'isbn'
  | 'pages'
  | 'format'
  | 'binding'
  | 'languages'
  | 'volumes'
  | 'barcode'
  | 'weight'
  | 'location'
  | 'slug'
  | 'created';

/**
 * כל העמודות שאפשר להציג. ברירת המחדל (DEFAULT_VISIBLE) היא בדיוק הסט
 * שהוצג לפני ההרחבה — מי שלא בחר דבר רואה את המסך המוכר; מי שבחר
 * עמודות נוספות, הבחירה נשמרת לו פר-משתמש (admin_user_prefs) ולא רק
 * בדפדפן הנוכחי.
 */
const TOGGLEABLE: { id: ColumnId; label: string }[] = [
  { id: 'catalogue_number', label: '#' },
  { id: 'author', label: 'מחבר' },
  { id: 'category', label: 'קטגוריה' },
  { id: 'sku', label: 'מק״ט' },
  { id: 'price', label: 'מחיר' },
  { id: 'stock', label: 'מלאי וזמינות' },
  { id: 'purchasable', label: 'ניתן לרכישה' },
  { id: 'year', label: 'שנה' },
  { id: 'completion', label: 'השלמה' },
  { id: 'updated', label: 'עודכן' },
  { id: 'series', label: 'סדרה' },
  { id: 'publisher', label: 'הוצאה לאור' },
  { id: 'edition', label: 'מהדורה' },
  { id: 'isbn', label: 'מסת״ב' },
  { id: 'pages', label: 'עמודים' },
  { id: 'format', label: 'פורמט' },
  { id: 'binding', label: 'כריכה (סוג)' },
  { id: 'languages', label: 'שפות' },
  { id: 'volumes', label: 'כרכים' },
  { id: 'barcode', label: 'ברקוד' },
  { id: 'weight', label: 'משקל' },
  { id: 'location', label: 'מיקום מלאי' },
  { id: 'slug', label: 'מזהה כתובת' },
  { id: 'created', label: 'נוצר' },
];

const DEFAULT_VISIBLE: ColumnId[] = [
  'catalogue_number',
  'author',
  'category',
  'sku',
  'price',
  'stock',
  'purchasable',
  'year',
  'completion',
  'updated',
];

const COLUMN_IDS = new Set<string>(TOGGLEABLE.map((column) => column.id));

export const BOOKS_COLUMNS_PREF_KEY = 'books-visible-columns';

const LANGUAGE_LABELS: Record<string, string> = {
  he: 'עברית',
  en: 'אנגלית',
  yi: 'יידיש',
  fr: 'צרפתית',
  ru: 'רוסית',
  es: 'ספרדית',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(
    new Date(value),
  );
}

/** [1.4] מבצע פעיל = יש מחיר מבצע והתאריך הנוכחי בתוך החלון (אם הוגדר). */
function isSaleActive(book: BookRow): boolean {
  if (book.sale_price == null) return false;
  const now = Date.now();
  if (book.sale_starts_at && new Date(book.sale_starts_at).getTime() > now) return false;
  if (book.sale_ends_at && new Date(book.sale_ends_at).getTime() < now) return false;
  return true;
}

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder' | 'unmanaged';

function stockStatus(book: BookRow): StockStatus {
  if (book.preorder_enabled) return 'preorder';
  if (!book.is_stock_managed) return 'unmanaged';
  const qty = book.stock_quantity ?? 0;
  if (qty <= 0) return 'out_of_stock';
  if (qty <= (book.low_stock_threshold ?? 2)) return 'low_stock';
  return 'in_stock';
}

const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  in_stock: 'במלאי',
  low_stock: 'מלאי נמוך',
  out_of_stock: 'אזל',
  preorder: 'הזמנה מוקדמת',
  unmanaged: 'לא מנוהל',
};

const STOCK_STATUS_BADGE: Record<StockStatus, string> = {
  in_stock: 'admin-badge-success',
  low_stock: 'admin-badge-warning',
  out_of_stock: 'admin-badge-danger',
  preorder: 'admin-badge-accent',
  unmanaged: 'admin-badge-neutral',
};

type PublishFilter = 'all' | 'published' | 'draft';
type PurchasableFilter = 'all' | 'yes' | 'no';
type StockFilter = 'all' | 'out_of_stock' | 'low_stock' | 'no_price';

type SortKey = ColumnId | 'title';
type SortState = { key: SortKey; direction: 'asc' | 'desc' } | null;

interface Row {
  book: BookRow;
  signals: CompletionSignals;
  completionPercent: number;
}

/**
 * טבלת ספרים אינטראקטיבית: חיפוש בצד הלקוח, מיון לפי עמודה, בחירת
 * עמודות (נשמרת פר-משתמש) ובחירת שורות לפעולה מרוכזת.
 *
 * הנתונים מגיעים מוכנים מהעמוד (Server Component) — הרכיב הזה רק מסדר,
 * מסנן ומציג אותם; אין כאן קריאה למסד. כל הספרים כבר בזיכרון (קטלוג של
 * מוסד, לא חנות המונים), ולכן מיון וסינון בצד הלקוח אינם בעייתיים.
 */
export function BooksDataGrid({
  books,
  completionSignals,
  categories,
  series,
  initialVisibleColumns,
}: {
  books: BookRow[];
  completionSignals: BookCompletionSignalIds;
  categories: { id: string; name: string }[];
  series: { id: string; name: string }[];
  /** הבחירה השמורה של המשתמש; null = טרם נבחרה, מציגים את ברירת המחדל. */
  initialVisibleColumns: string[] | null;
}) {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() => {
    const saved = initialVisibleColumns?.filter((id): id is ColumnId => COLUMN_IDS.has(id));
    return new Set(saved && saved.length > 0 ? saved : DEFAULT_VISIBLE);
  });
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [purchasableFilter, setPurchasableFilter] = useState<PurchasableFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const seriesName = useMemo(() => new Map(series.map((s) => [s.id, s.name])), [series]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [columnsOpen]);

  function toggleColumn(id: ColumnId) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // שמירה מושהית פר-משתמש — לא קריאת שרת על כל קליק בדיאלוג
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveUserPref(BOOKS_COLUMNS_PREF_KEY, [...next]);
      }, 800);
      return next;
    });
  }

  const signalSets = useMemo(
    () => ({
      tags: new Set(completionSignals.tags),
      shelves: new Set(completionSignals.shelves),
      attributes: new Set(completionSignals.attributes),
      images: new Set(completionSignals.images),
      toc: new Set(completionSignals.toc),
      previews: new Set(completionSignals.previews),
    }),
    [completionSignals],
  );

  const rows: Row[] = useMemo(
    () =>
      books.map((book) => {
        // מד ההשלמה זקוק רק ל"יש/אין" מטבלאות הבת — ערך יחיד מספיק
        const signals: CompletionSignals = {
          tagIds: signalSets.tags.has(book.id) ? ['_'] : [],
          categoryIds: signalSets.shelves.has(book.id) ? ['_'] : [],
          attributeValueIds: signalSets.attributes.has(book.id) ? ['_'] : [],
          galleryCount: signalSets.images.has(book.id) ? 1 : 0,
          tocCount: signalSets.toc.has(book.id) ? 1 : 0,
          previewCount: signalSets.previews.has(book.id) ? 1 : 0,
        };
        return { book, signals, completionPercent: computeCompletion(book, signals).percent };
      }),
    [books, signalSets],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(({ book }) => {
      if (needle) {
        const haystack = [
          book.title_he,
          book.subtitle_he,
          book.author_name_he,
          book.author?.name_he,
          book.sku,
          book.isbn,
          String(book.catalogue_number),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (publishFilter === 'published' && !book.is_published) return false;
      if (publishFilter === 'draft' && book.is_published) return false;
      if (purchasableFilter === 'yes' && !book.is_purchasable) return false;
      if (purchasableFilter === 'no' && book.is_purchasable) return false;
      if (stockFilter === 'out_of_stock' && stockStatus(book) !== 'out_of_stock') return false;
      if (stockFilter === 'low_stock' && stockStatus(book) !== 'low_stock') return false;
      if (stockFilter === 'no_price' && book.price != null) return false;
      return true;
    });
  }, [rows, query, publishFilter, purchasableFilter, stockFilter]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const factor = sort.direction === 'asc' ? 1 : -1;
    const text = (value: string | null | undefined) => value ?? '';
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case 'catalogue_number':
          return factor * (a.book.catalogue_number - b.book.catalogue_number);
        case 'title':
          return factor * a.book.title_he.localeCompare(b.book.title_he, 'he');
        case 'author':
          return (
            factor *
            (a.book.author_name_he ?? a.book.author?.name_he ?? '').localeCompare(
              b.book.author_name_he ?? b.book.author?.name_he ?? '',
              'he',
            )
          );
        case 'year':
          // ספרים בלי שנה לועזית מקובצים יחד ולא נזרקים לקצה המיון בטעות
          return factor * ((a.book.publication_year_ce ?? 0) - (b.book.publication_year_ce ?? 0));
        case 'completion':
          return factor * (a.completionPercent - b.completionPercent);
        case 'updated':
          return factor * a.book.updated_at.localeCompare(b.book.updated_at);
        case 'created':
          return factor * a.book.created_at.localeCompare(b.book.created_at);
        case 'sku':
          return factor * text(a.book.sku).localeCompare(text(b.book.sku), 'he');
        case 'category':
          return (
            factor *
            (categoryName.get(a.book.category_id ?? '') ?? '').localeCompare(
              categoryName.get(b.book.category_id ?? '') ?? '',
              'he',
            )
          );
        case 'series':
          return (
            factor *
            (seriesName.get(a.book.series_id ?? '') ?? '').localeCompare(
              seriesName.get(b.book.series_id ?? '') ?? '',
              'he',
            )
          );
        case 'publisher':
          return factor * text(a.book.publisher_he).localeCompare(text(b.book.publisher_he), 'he');
        case 'edition':
          return factor * text(a.book.edition_he).localeCompare(text(b.book.edition_he), 'he');
        case 'isbn':
          return factor * text(a.book.isbn).localeCompare(text(b.book.isbn));
        case 'pages':
          return factor * ((a.book.pages ?? 0) - (b.book.pages ?? 0));
        case 'format':
          return factor * text(a.book.format).localeCompare(text(b.book.format), 'he');
        case 'binding':
          return factor * text(a.book.binding).localeCompare(text(b.book.binding), 'he');
        case 'volumes':
          return factor * ((a.book.volume_count ?? 1) - (b.book.volume_count ?? 1));
        case 'barcode':
          return factor * text(a.book.barcode).localeCompare(text(b.book.barcode));
        case 'weight':
          return factor * ((a.book.weight_grams ?? 0) - (b.book.weight_grams ?? 0));
        case 'location':
          return factor * text(a.book.stock_location).localeCompare(text(b.book.stock_location), 'he');
        case 'slug':
          return factor * a.book.slug.localeCompare(b.book.slug, 'he');
        case 'price':
          return factor * ((a.book.price ?? -1) - (b.book.price ?? -1));
        case 'stock':
          return factor * ((a.book.stock_quantity ?? 0) - (b.book.stock_quantity ?? 0));
        case 'purchasable':
          return factor * (Number(a.book.is_purchasable) - Number(b.book.is_purchasable));
        default:
          return 0;
      }
    });
  }, [filtered, sort, categoryName, seriesName]);

  const visibleIds = useMemo(() => sorted.map((row) => row.book.id), [sorted]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someVisibleSelected = visibleIds.some((id) => selected.has(id));

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((current) => {
      if (allVisibleSelected) {
        const next = new Set(current);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...current, ...visibleIds]);
    });
  }

  function sortIndicator(key: SortKey) {
    if (!sort || sort.key !== key) return null;
    return sort.direction === 'asc' ? '↑' : '↓';
  }

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: 'asc' };
      if (current.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
  }

  const shown = (id: ColumnId) => visibleColumns.has(id);
  const label = (id: ColumnId) => TOGGLEABLE.find((column) => column.id === id)?.label ?? id;

  /** כל העמודות הפעילות, בסדר התצוגה הקבוע — כותרת ותא נבנים מאותה רשימה. */
  const activeColumns = TOGGLEABLE.filter((column) => shown(column.id));

  function cellFor(id: ColumnId, row: Row) {
    const { book, signals } = row;
    switch (id) {
      case 'catalogue_number':
        return <td key={id} className="text-muted tabular-nums">{book.catalogue_number}</td>;
      case 'author':
        return <td key={id} className="text-muted">{book.author_name_he ?? book.author?.name_he ?? '—'}</td>;
      case 'category':
        return <td key={id} className="text-muted">{categoryName.get(book.category_id ?? '') ?? '—'}</td>;
      case 'series':
        return <td key={id} className="text-muted">{seriesName.get(book.series_id ?? '') ?? '—'}</td>;
      case 'sku':
        return <td key={id} dir="ltr" className="text-start text-caption text-muted">{book.sku ?? '—'}</td>;
      case 'price': {
        const onSale = isSaleActive(book);
        return (
          <td key={id} className="tabular-nums">
            {book.price == null ? (
              <span className="text-[var(--admin-danger)]">ללא מחיר</span>
            ) : onSale ? (
              <>
                <span className="text-caption text-muted line-through">
                  {formatPrice(book.price, 'he')}
                </span>{' '}
                {formatPrice(book.sale_price as number, 'he')}
              </>
            ) : (
              formatPrice(book.price, 'he')
            )}
          </td>
        );
      }
      case 'stock': {
        const status = stockStatus(book);
        return (
          <td key={id}>
            <span className={`admin-badge ${STOCK_STATUS_BADGE[status]}`}>
              {status === 'in_stock' || status === 'low_stock'
                ? `${book.stock_quantity ?? 0} · ${STOCK_STATUS_LABEL[status]}`
                : STOCK_STATUS_LABEL[status]}
            </span>
          </td>
        );
      }
      case 'purchasable':
        return (
          <td key={id}>
            <span className={`admin-badge ${book.is_purchasable ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
              {book.is_purchasable ? 'כן' : 'לא'}
            </span>
          </td>
        );
      case 'year':
        return (
          <td key={id} className="text-muted">
            {book.publication_year_he || book.publication_year_ce || '—'}
          </td>
        );
      case 'completion':
        return (
          <td key={id}>
            <CompletionBadge book={book} signals={signals} />
          </td>
        );
      case 'updated':
        return (
          <td key={id} className="text-caption text-muted tabular-nums" title={formatDate(book.created_at)}>
            {formatDate(book.updated_at)}
          </td>
        );
      case 'created':
        return <td key={id} className="text-caption text-muted tabular-nums">{formatDate(book.created_at)}</td>;
      case 'publisher':
        return <td key={id} className="text-muted">{book.publisher_he ?? '—'}</td>;
      case 'edition':
        return <td key={id} className="text-muted">{book.edition_he ?? '—'}</td>;
      case 'isbn':
        return <td key={id} dir="ltr" className="text-start text-caption text-muted">{book.isbn ?? '—'}</td>;
      case 'pages':
        return <td key={id} className="text-muted tabular-nums">{book.pages ?? '—'}</td>;
      case 'format':
        return <td key={id} className="text-muted">{book.format ?? '—'}</td>;
      case 'binding':
        return <td key={id} className="text-muted">{book.binding ?? '—'}</td>;
      case 'languages':
        return (
          <td key={id} className="text-caption text-muted">
            {book.languages.length > 0
              ? book.languages.map((code) => LANGUAGE_LABELS[code] ?? code).join(', ')
              : '—'}
          </td>
        );
      case 'volumes':
        return <td key={id} className="text-muted tabular-nums">{book.volume_count ?? 1}</td>;
      case 'barcode':
        return <td key={id} dir="ltr" className="text-start text-caption text-muted">{book.barcode ?? '—'}</td>;
      case 'weight':
        return (
          <td key={id} className="text-muted tabular-nums">
            {book.weight_grams != null ? `${book.weight_grams} ג׳` : '—'}
          </td>
        );
      case 'location':
        return <td key={id} className="text-muted">{book.stock_location ?? '—'}</td>;
      case 'slug':
        return <td key={id} dir="auto" className="text-caption text-muted">{book.slug}</td>;
      default:
        return <td key={id} />;
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <AdminIcon
            name="search"
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בשם, מחבר או מק״ט"
            aria-label="חיפוש בטבלת הספרים"
            className="admin-field-input ps-9"
          />
        </div>
        <span className="text-caption text-muted">
          {sorted.length} מתוך {books.length}
        </span>

        <div ref={columnsRef} className="relative ms-auto">
          <button
            type="button"
            onClick={() => setColumnsOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={columnsOpen}
            className="admin-btn admin-btn-quiet"
          >
            <AdminIcon name="columns" className="h-4 w-4" />
            עמודות
          </button>
          {columnsOpen ? (
            <div className="admin-nav-dropdown admin-nav-dropdown-end max-h-80 overflow-y-auto">
              {TOGGLEABLE.map((column) => (
                <label
                  key={column.id}
                  className="admin-nav-dropdown-item cursor-pointer justify-between"
                >
                  {column.label}
                  <input
                    type="checkbox"
                    checked={shown(column.id)}
                    onChange={() => toggleColumn(column.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--admin-accent)]"
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* [1.4] מסננים — לפני התיקון לא היה ולו מסנן אחד; זו בדיוק הדרך
          לתפעל חנות (למצוא ספרים בלי מחיר, שאזלו, או שלא מתפרסמים). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={publishFilter}
          onChange={(e) => setPublishFilter(e.target.value as PublishFilter)}
          aria-label="סינון לפי פרסום"
          className="admin-field-input w-auto py-1.5"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="published">מפורסמים</option>
          <option value="draft">טיוטות</option>
        </select>
        <select
          value={purchasableFilter}
          onChange={(e) => setPurchasableFilter(e.target.value as PurchasableFilter)}
          aria-label="סינון לפי ניתן לרכישה"
          className="admin-field-input w-auto py-1.5"
        >
          <option value="all">ניתן לרכישה — הכל</option>
          <option value="yes">ניתן לרכישה</option>
          <option value="no">לא ניתן לרכישה</option>
        </select>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as StockFilter)}
          aria-label="סינון לפי מלאי ומחיר"
          className="admin-field-input w-auto py-1.5"
        >
          <option value="all">מלאי — הכל</option>
          <option value="out_of_stock">אזל מהמלאי</option>
          <option value="low_stock">מלאי נמוך</option>
          <option value="no_price">ללא מחיר</option>
        </select>
        {publishFilter !== 'all' || purchasableFilter !== 'all' || stockFilter !== 'all' ? (
          <button
            type="button"
            onClick={() => {
              setPublishFilter('all');
              setPurchasableFilter('all');
              setStockFilter('all');
            }}
            className="admin-btn admin-btn-ghost"
          >
            <AdminIcon name="x" className="h-4 w-4" />
            איפוס מסננים
          </button>
        ) : null}
      </div>

      {selected.size > 0 ? <BulkActionBar selected={selected} onDone={() => setSelected(new Set())} /> : null}

      <div className="admin-table-wrap overflow-x-auto">
        <table className="admin-table min-w-[64rem]">
          <thead>
            <tr>
              <th scope="col">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="בחירת כל הספרים המוצגים"
                  className="h-4 w-4 accent-[var(--admin-accent)]"
                />
              </th>
              <th scope="col" aria-label="כריכה" />
              {shown('catalogue_number') ? (
                <SortableHeader label="#" active={sortIndicator('catalogue_number')} onClick={() => toggleSort('catalogue_number')} />
              ) : null}
              <SortableHeader label="שם הספר" active={sortIndicator('title')} onClick={() => toggleSort('title')} />
              {activeColumns
                .filter((column) => column.id !== 'catalogue_number')
                .map((column) => (
                  <SortableHeader
                    key={column.id}
                    label={label(column.id)}
                    active={sortIndicator(column.id)}
                    onClick={() => toggleSort(column.id)}
                  />
                ))}
              <th scope="col">מצב ופעולות</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const { book } = row;
              return (
                <tr key={book.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(book.id)}
                      onChange={() => toggleRow(book.id)}
                      aria-label={`בחירת ${book.title_he}`}
                      className="h-4 w-4 accent-[var(--admin-accent)]"
                    />
                  </td>
                  <td>
                    {book.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- תמונונת קטנה בטבלה; אין צורך באופטימיזציית next/image
                      <img
                        src={toCdnUrl(book.cover_image_url)}
                        alt=""
                        className="h-10 w-8 rounded-[4px] border border-rule object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-8 items-center justify-center rounded-[4px] bg-cream-2 text-muted">
                        <AdminIcon name="books" className="h-4 w-4" />
                      </span>
                    )}
                  </td>
                  {shown('catalogue_number') ? cellFor('catalogue_number', row) : null}
                  <td>
                    <Link href={`/admin/books/${book.id}`} className="font-semibold hover:text-[var(--admin-accent)]">
                      {book.title_he}
                    </Link>
                    {book.subtitle_he ? (
                      <span className="mt-0.5 block text-caption text-muted">{book.subtitle_he}</span>
                    ) : null}
                  </td>
                  {activeColumns
                    .filter((column) => column.id !== 'catalogue_number')
                    .map((column) => cellFor(column.id, row))}
                  <td>
                    <RowActions
                      entity="books"
                      id={book.id}
                      label={book.title_he}
                      published={book.is_published}
                      viewHref={`/books/${book.slug}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-muted">
            {books.length === 0 ? 'טרם נוספו ספרים.' : 'אין ספר התואם את החיפוש.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: string | null;
  onClick: () => void;
}) {
  const ariaSort = active === '↑' ? 'ascending' : active === '↓' ? 'descending' : 'none';
  return (
    <th scope="col" aria-sort={ariaSort}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-ink">
        {label}
        <span aria-hidden="true">{active ?? ''}</span>
      </button>
    </th>
  );
}

/** סרגל הפעולות המרוכזות שמופיע כשנבחרה שורה אחת לפחות. */
function BulkActionBar({ selected, onDone }: { selected: Set<string>; onDone: () => void }) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: 'publish' | 'unpublish' | 'delete') {
    startTransition(async () => {
      setError(null);
      const result = await bulkUpdateBooks([...selected], action);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setConfirmingDelete(false);
      onDone();
    });
  }

  return (
    <div className="admin-card mb-4 flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="admin-badge admin-badge-accent">{selected.size} נבחרו</span>

      {confirmingDelete ? (
        <>
          <span role="alert" className="text-small font-semibold text-[var(--admin-danger)]">
            למחוק לצמיתות {selected.size} ספרים?
          </span>
          <button type="button" disabled={pending} onClick={() => run('delete')} className="admin-btn admin-btn-danger">
            {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
            כן, למחוק
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} className="admin-btn admin-btn-ghost">
            ביטול
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => run('publish')} className="admin-btn admin-btn-quiet">
            <AdminIcon name="check" className="h-4 w-4" />
            פרסום
          </button>
          <button type="button" disabled={pending} onClick={() => run('unpublish')} className="admin-btn admin-btn-quiet">
            <AdminIcon name="x" className="h-4 w-4" />
            ביטול פרסום
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            className="admin-btn admin-btn-danger"
          >
            <AdminIcon name="trash" className="h-4 w-4" />
            מחיקה
          </button>
          <button type="button" onClick={onDone} className="admin-btn admin-btn-ghost ms-auto">
            <AdminIcon name="x" className="h-4 w-4" />
            ניקוי בחירה
          </button>
        </>
      )}

      {error ? (
        <span role="alert" className="w-full text-caption text-[var(--admin-danger)]">
          {error}
        </span>
      ) : null}
    </div>
  );
}
