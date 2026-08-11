'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { bulkUpdateBooks } from '@/lib/admin/actions';
import type { BookRow } from '@/lib/admin/queries';
import { computeCompletion } from '@/lib/completion';
import { useLocalList } from '@/lib/client-hooks';
import { formatPrice } from '@/lib/commerce/pricing';
import { toCdnUrl } from '@/lib/image-src';
import { AdminIcon } from './AdminIcons';
import { CompletionBadge } from './CompletionBadge';
import { RowActions } from './RowActions';
import { Spinner } from './SubmitButton';
import type { BookRelations } from '@/lib/supabase/types';

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
  | 'purchasable';

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
];

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
  relations: BookRelations;
  completionPercent: number;
}

/**
 * טבלת ספרים אינטראקטיבית: חיפוש בצד הלקוח, מיון לפי עמודה, הסתרת עמודות
 * (נשמרת מקומית) ובחירת שורות לפעולה מרוכזת.
 *
 * הנתונים מגיעים מוכנים מהעמוד (Server Component) — הרכיב הזה רק מסדר,
 * מסנן ומציג אותם; אין כאן קריאה למסד. כל הספרים כבר בזיכרון (קטלוג של
 * מוסד, לא חנות המונים), ולכן מיון וסינון בצד הלקוח אינם בעייתיים.
 */
export function BooksDataGrid({
  books,
  bookIdsWithTags,
  categories,
}: {
  books: BookRow[];
  bookIdsWithTags: string[];
  categories: { id: string; name: string }[];
}) {
  const hiddenColumns = useLocalList('admin-books-hidden-columns');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [purchasableFilter, setPurchasableFilter] = useState<PurchasableFilter>('all');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [columnsOpen]);

  const tagSet = useMemo(() => new Set(bookIdsWithTags), [bookIdsWithTags]);

  const rows: Row[] = useMemo(
    () =>
      books.map((book) => {
        const relations: BookRelations = {
          tagIds: tagSet.has(book.id) ? ['_'] : [],
          categoryIds: [],
          attributeValueIds: [],
        };
        return { book, relations, completionPercent: computeCompletion(book, relations).percent };
      }),
    [books, tagSet],
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
        case 'sku':
          return factor * (a.book.sku ?? '').localeCompare(b.book.sku ?? '', 'he');
        case 'category':
          return (
            factor *
            (categoryName.get(a.book.category_id ?? '') ?? '').localeCompare(
              categoryName.get(b.book.category_id ?? '') ?? '',
              'he',
            )
          );
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
  }, [filtered, sort, categoryName]);

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

  const shown = (id: ColumnId) => !hiddenColumns.has(id);

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
            <div className="admin-nav-dropdown admin-nav-dropdown-end">
              {TOGGLEABLE.map((column) => (
                <label
                  key={column.id}
                  className="admin-nav-dropdown-item cursor-pointer justify-between"
                >
                  {column.label}
                  <input
                    type="checkbox"
                    checked={shown(column.id)}
                    onChange={() => hiddenColumns.toggle(column.id)}
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
              {shown('author') ? (
                <SortableHeader label="מחבר" active={sortIndicator('author')} onClick={() => toggleSort('author')} />
              ) : null}
              {shown('category') ? (
                <SortableHeader label="קטגוריה" active={sortIndicator('category')} onClick={() => toggleSort('category')} />
              ) : null}
              {shown('sku') ? (
                <SortableHeader label="מק״ט" active={sortIndicator('sku')} onClick={() => toggleSort('sku')} />
              ) : null}
              {shown('price') ? (
                <SortableHeader label="מחיר" active={sortIndicator('price')} onClick={() => toggleSort('price')} />
              ) : null}
              {shown('stock') ? (
                <SortableHeader label="מלאי וזמינות" active={sortIndicator('stock')} onClick={() => toggleSort('stock')} />
              ) : null}
              {shown('purchasable') ? (
                <SortableHeader label="ניתן לרכישה" active={sortIndicator('purchasable')} onClick={() => toggleSort('purchasable')} />
              ) : null}
              {shown('year') ? (
                <SortableHeader label="שנה" active={sortIndicator('year')} onClick={() => toggleSort('year')} />
              ) : null}
              {shown('completion') ? (
                <SortableHeader label="השלמה" active={sortIndicator('completion')} onClick={() => toggleSort('completion')} />
              ) : null}
              {shown('updated') ? (
                <SortableHeader label="עודכן" active={sortIndicator('updated')} onClick={() => toggleSort('updated')} />
              ) : null}
              <th scope="col">מצב ופעולות</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ book, relations }) => {
              const status = stockStatus(book);
              const onSale = isSaleActive(book);
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
                {shown('catalogue_number') ? (
                  <td className="text-muted tabular-nums">{book.catalogue_number}</td>
                ) : null}
                <td>
                  <Link href={`/admin/books/${book.id}`} className="font-semibold hover:text-[var(--admin-accent)]">
                    {book.title_he}
                  </Link>
                  {book.subtitle_he ? (
                    <span className="mt-0.5 block text-caption text-muted">{book.subtitle_he}</span>
                  ) : null}
                </td>
                {shown('author') ? (
                  <td className="text-muted">{book.author_name_he ?? book.author?.name_he ?? '—'}</td>
                ) : null}
                {shown('category') ? (
                  <td className="text-muted">{categoryName.get(book.category_id ?? '') ?? '—'}</td>
                ) : null}
                {shown('sku') ? (
                  <td dir="ltr" className="text-start text-caption text-muted">{book.sku ?? '—'}</td>
                ) : null}
                {shown('price') ? (
                  <td className="tabular-nums">
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
                ) : null}
                {shown('stock') ? (
                  <td>
                    <span className={`admin-badge ${STOCK_STATUS_BADGE[status]}`}>
                      {status === 'in_stock' || status === 'low_stock'
                        ? `${book.stock_quantity ?? 0} · ${STOCK_STATUS_LABEL[status]}`
                        : STOCK_STATUS_LABEL[status]}
                    </span>
                  </td>
                ) : null}
                {shown('purchasable') ? (
                  <td>
                    <span className={`admin-badge ${book.is_purchasable ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                      {book.is_purchasable ? 'כן' : 'לא'}
                    </span>
                  </td>
                ) : null}
                {shown('year') ? (
                  <td className="text-muted">
                    {book.publication_year_he || book.publication_year_ce || '—'}
                  </td>
                ) : null}
                {shown('completion') ? (
                  <td>
                    <CompletionBadge book={book} relations={relations} />
                  </td>
                ) : null}
                {shown('updated') ? (
                  <td className="text-caption text-muted tabular-nums" title={formatDate(book.created_at)}>
                    {formatDate(book.updated_at)}
                  </td>
                ) : null}
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
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-ink">
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
