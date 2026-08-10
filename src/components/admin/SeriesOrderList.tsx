'use client';

import { useId, useState, useTransition } from 'react';
import { saveSeriesOrder } from '@/lib/admin/actions';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

export interface SeriesOrderBook {
  id: string;
  title: string;
  coverUrl: string | null;
}

/**
 * [1.10] סדר הכרכים בסדרה כרשימת גרירה — לא הקלדת "מיקום בסדרה" כמספר
 * חופשי. native HTML5 drag/drop כמו ShelfBooksPicker, אבל רשימה בודדת
 * בלי מאגר-מקור: השיוך לסדרה עצמו נקבע בטופס הספר (series_id), כאן רק
 * הסדר בין מי שכבר משויכים.
 *
 * pendingBookId — ספר שנבחרה לו הסדרה הזו בטופס אך עדיין אינו שייך לה
 * במסד בפועל (ספר חדש שטרם נשמר, או סדרה שזה עתה נבחרה): מוצג כשורה
 * אחרונה מסומנת "יתווסף בשמירה", בלי אפשרות גרירה — שאר הספרים ניתנים
 * לסידור מחדש בלי תלות בו.
 */
export function SeriesOrderList({
  seriesId,
  books,
  pendingBookId,
  pendingBookTitle,
}: {
  seriesId: string;
  books: SeriesOrderBook[];
  pendingBookId?: string;
  pendingBookTitle?: string;
}) {
  const [order, setOrder] = useState<string[]>(() => books.map((book) => book.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  const byId = new Map(books.map((book) => [book.id, book]));
  const orderedBooks = order.map((id) => byId.get(id)).filter((book): book is SeriesOrderBook => Boolean(book));
  const showPendingRow = pendingBookId && !byId.has(pendingBookId);

  const moveBook = (index: number, delta: number) => {
    setOrder((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStatus('idle');
  };

  function dropAt(event: React.DragEvent, targetIndex: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    setDragOverIndex(null);
    setDragId(null);
    if (!id || !byId.has(id)) return;

    setOrder((current) => {
      const withoutDragged = current.filter((x) => x !== id);
      const clampedIndex = Math.min(targetIndex, withoutDragged.length);
      return [...withoutDragged.slice(0, clampedIndex), id, ...withoutDragged.slice(clampedIndex)];
    });
    setStatus('idle');
  }

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await saveSeriesOrder(seriesId, order);
      if (result?.error) {
        setError(result.error);
        setStatus('error');
        return;
      }
      setStatus('saved');
    });
  }

  if (books.length === 0 && !showPendingRow) {
    return <p className="text-caption text-muted">אין עדיין ספרים אחרים בסדרה הזו.</p>;
  }

  return (
    <div>
      <ul id={listId} className="space-y-1 rounded-[var(--admin-radius-card)] border border-rule p-2">
        {orderedBooks.map((book, index) => (
          <li
            key={book.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData('text/plain', book.id);
              event.dataTransfer.effectAllowed = 'move';
              setDragId(book.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setDragOverIndex(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOverIndex(index);
            }}
            onDrop={(event) => dropAt(event, index)}
            className={`flex cursor-grab items-center gap-3 rounded-[var(--admin-radius-btn)] p-2 transition-colors active:cursor-grabbing ${
              dragId === book.id ? 'opacity-40' : ''
            } ${dragOverIndex === index && dragId !== book.id ? 'bg-cream-2' : ''} ${
              book.id === pendingBookId ? 'ring-1 ring-inset ring-[var(--admin-accent)]' : ''
            }`}
          >
            <span className="w-5 shrink-0 text-center text-caption tabular-nums text-muted">{index + 1}</span>
            {book.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה קטנה בממשק הניהול
              <img src={book.coverUrl} alt="" className="h-10 w-8 shrink-0 rounded-[2px] object-cover" />
            ) : (
              <span className="h-10 w-8 shrink-0 rounded-[2px] bg-cream-2" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate text-small text-ink">{book.title}</span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => moveBook(index, -1)}
                disabled={index === 0}
                className="admin-btn admin-btn-ghost admin-btn-icon disabled:opacity-30"
                aria-label={`הקדמת ${book.title}`}
                title="הקדמה"
              >
                <AdminIcon name="chevron-down" className="h-4 w-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => moveBook(index, 1)}
                disabled={index === orderedBooks.length - 1}
                className="admin-btn admin-btn-ghost admin-btn-icon disabled:opacity-30"
                aria-label={`איחור ${book.title}`}
                title="איחור"
              >
                <AdminIcon name="chevron-down" className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
        {showPendingRow ? (
          <li className="flex items-center gap-3 rounded-[var(--admin-radius-btn)] border border-dashed border-rule p-2 text-muted">
            <span className="w-5 shrink-0 text-center text-caption tabular-nums">{orderedBooks.length + 1}</span>
            <span className="h-10 w-8 shrink-0 rounded-[2px] bg-cream-2" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-small">{pendingBookTitle}</span>
            <span className="shrink-0 text-caption">יתווסף בשמירה</span>
          </li>
        ) : null}
      </ul>

      {orderedBooks.length > 1 ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" disabled={pending} onClick={save} className="admin-btn admin-btn-quiet">
            {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
            שמירת סדר הסדרה
          </button>
          {status === 'saved' ? (
            <p role="status" className="admin-badge admin-badge-success">
              <span className="admin-badge-dot" aria-hidden="true" />
              נשמר
            </p>
          ) : null}
          {status === 'error' && error ? (
            <p role="alert" className="text-small text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
