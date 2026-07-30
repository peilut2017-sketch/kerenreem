'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { bulkUpdateBooks } from '@/lib/admin/actions';
import type { BookRow } from '@/lib/admin/queries';
import { computeCompletion } from '@/lib/completion';
import { useLocalList } from '@/lib/client-hooks';
import { CompletionBadge } from './CompletionBadge';
import { RowActions } from './RowActions';
import { Spinner } from './SubmitButton';
import type { BookRelations } from '@/lib/supabase/types';

type ColumnId = 'catalogue_number' | 'author' | 'year' | 'completion';

const TOGGLEABLE: { id: ColumnId; label: string }[] = [
  { id: 'catalogue_number', label: '#' },
  { id: 'author', label: 'מחבר' },
  { id: 'year', label: 'שנה' },
  { id: 'completion', label: 'השלמה' },
];

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
}: {
  books: BookRow[];
  bookIdsWithTags: string[];
}) {
  const hiddenColumns = useLocalList('admin-books-hidden-columns');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);

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
    if (!needle) return rows;
    return rows.filter(({ book }) => {
      const haystack = [
        book.title_he,
        book.subtitle_he,
        book.author?.name_he,
        book.sku,
        String(book.catalogue_number),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, query]);

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
            (a.book.author?.name_he ?? '').localeCompare(b.book.author?.name_he ?? '', 'he')
          );
        case 'year':
          // ספרים בלי שנה לועזית מקובצים יחד ולא נזרקים לקצה המיון בטעות
          return factor * ((a.book.publication_year_ce ?? 0) - (b.book.publication_year_ce ?? 0));
        case 'completion':
          return factor * (a.completionPercent - b.completionPercent);
        default:
          return 0;
      }
    });
  }, [filtered, sort]);

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
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש בשם, מחבר או מק״ט"
          aria-label="חיפוש בטבלת הספרים"
          className="field-input max-w-xs"
        />
        <span className="text-caption text-muted">
          {sorted.length} מתוך {books.length}
        </span>

        <div ref={columnsRef} className="relative ms-auto">
          <button
            type="button"
            onClick={() => setColumnsOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={columnsOpen}
            className="btn btn-quiet"
          >
            עמודות
          </button>
          {columnsOpen ? (
            <div className="absolute end-0 z-10 mt-2 w-48 rounded-[var(--radius-md)] border border-rule bg-cream-2 p-3 shadow-[var(--shadow-float)]">
              {TOGGLEABLE.map((column) => (
                <label key={column.id} className="flex items-center gap-2.5 py-1 text-small text-ink-soft">
                  <input
                    type="checkbox"
                    checked={shown(column.id)}
                    onChange={() => hiddenColumns.toggle(column.id)}
                    className="h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {selected.size > 0 ? <BulkActionBar selected={selected} onDone={() => setSelected(new Set())} /> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-small">
          <thead>
            <tr className="border-y border-rule text-start">
              <th scope="col" className="py-2.5 pe-4">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="בחירת כל הספרים המוצגים"
                  className="h-4 w-4 accent-[var(--color-burgundy)]"
                />
              </th>
              {shown('catalogue_number') ? (
                <SortableHeader label="#" active={sortIndicator('catalogue_number')} onClick={() => toggleSort('catalogue_number')} />
              ) : null}
              <SortableHeader label="שם הספר" active={sortIndicator('title')} onClick={() => toggleSort('title')} />
              {shown('author') ? (
                <SortableHeader label="מחבר" active={sortIndicator('author')} onClick={() => toggleSort('author')} />
              ) : null}
              {shown('year') ? (
                <SortableHeader label="שנה" active={sortIndicator('year')} onClick={() => toggleSort('year')} />
              ) : null}
              {shown('completion') ? (
                <SortableHeader label="השלמה" active={sortIndicator('completion')} onClick={() => toggleSort('completion')} />
              ) : null}
              <th scope="col" className="py-2.5 pe-4 text-start font-semibold text-muted">
                מצב ופעולות
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ book, relations }) => (
              <tr key={book.id} className="border-b border-rule align-top">
                <td className="py-3 pe-4">
                  <input
                    type="checkbox"
                    checked={selected.has(book.id)}
                    onChange={() => toggleRow(book.id)}
                    aria-label={`בחירת ${book.title_he}`}
                    className="h-4 w-4 accent-[var(--color-burgundy)]"
                  />
                </td>
                {shown('catalogue_number') ? (
                  <td className="py-3 pe-4 text-muted tabular-nums">{book.catalogue_number}</td>
                ) : null}
                <td className="py-3 pe-4">
                  <Link href={`/admin/books/${book.id}`} className="font-semibold hover:text-burgundy">
                    {book.title_he}
                  </Link>
                  {book.subtitle_he ? (
                    <span className="mt-0.5 block text-caption text-muted">{book.subtitle_he}</span>
                  ) : null}
                </td>
                {shown('author') ? <td className="py-3 pe-4 text-muted">{book.author?.name_he ?? '—'}</td> : null}
                {shown('year') ? (
                  <td className="py-3 pe-4 text-muted">
                    {book.publication_year_he || book.publication_year_ce || '—'}
                  </td>
                ) : null}
                {shown('completion') ? (
                  <td className="py-3 pe-4">
                    <CompletionBadge book={book} relations={relations} />
                  </td>
                ) : null}
                <td className="py-3 pe-4">
                  <RowActions entity="books" id={book.id} label={book.title_he} published={book.is_published} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 ? (
          <p className="py-8 text-muted">
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
  return (
    <th scope="col" className="py-2.5 pe-4 text-start font-semibold text-muted">
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
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-rule-strong bg-cream-2 px-4 py-3">
      <span className="text-small font-semibold text-ink">{selected.size} נבחרו</span>

      {confirmingDelete ? (
        <>
          <span role="alert" className="text-small text-burgundy">
            למחוק לצמיתות {selected.size} ספרים?
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run('delete')}
            className="inline-flex items-center gap-1.5 text-small font-semibold text-burgundy underline underline-offset-4"
          >
            {pending ? <Spinner className="h-3 w-3" /> : null}
            כן, למחוק
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-small text-muted underline underline-offset-4"
          >
            ביטול
          </button>
        </>
      ) : (
        <>
          <button type="button" disabled={pending} onClick={() => run('publish')} className="btn btn-quiet">
            פרסום
          </button>
          <button type="button" disabled={pending} onClick={() => run('unpublish')} className="btn btn-quiet">
            ביטול פרסום
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmingDelete(true)}
            className="text-small text-burgundy underline underline-offset-4"
          >
            מחיקה
          </button>
          <button type="button" onClick={onDone} className="ms-auto text-small text-muted underline underline-offset-4">
            ניקוי בחירה
          </button>
        </>
      )}

      {error ? (
        <span role="alert" className="w-full text-caption text-burgundy">
          {error}
        </span>
      ) : null}
    </div>
  );
}
