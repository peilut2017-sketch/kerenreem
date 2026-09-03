'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { saveShelfBooks } from '@/lib/admin/settings-actions';
import { toCdnUrl } from '@/lib/image-src';
import { AdminIcon } from './AdminIcons';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { Spinner } from './SubmitButton';

interface PickerBook {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
}

/**
 * בחירת הספרים שמוצגים במדף בעמוד הבית, וסדר התצוגה שלהם.
 *
 * גרירה בין "כל הספרים" ל"ספרי המדף", וגרירה בתוך רשימת המדף לסידור
 * מחדש — native HTML5 drag/drop, בלי ספריית עזר. לצד הגרירה יש גם
 * כפתורי הוספה/הסרה/הקדמה/איחור: כך שהבחירה נגישה גם למי שמנווט
 * במקלדת או בקורא מסך, לא רק בעכבר.
 *
 * "שמירה" קוראת ל-Server Action ישירות (לא <form action>): המצב כבר
 * חי כאן בלקוח בזכות הגרירה, ואין תועלת בעקיפה דרך FormData לפעולה
 * שממילא לא עובדת בלי JavaScript (גרירה עצמה דורשת אותו).
 */
export function ShelfBooksPicker({ books, defaultIds }: { books: PickerBook[]; defaultIds: string[] }) {
  const [activeIds, setActiveIds] = useState<string[]>(() =>
    defaultIds.filter((id) => books.some((book) => book.id === id)),
  );
  const [query, setQuery] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  // סידור מחדש של עשרים ספרים ואז רענון בטעות — בלי האזהרה הכול היה נמחק בשקט.
  const [dirty, setDirty] = useState(false);
  useUnsavedChangesWarning(dirty);
  const listId = useId();

  const byId = useMemo(() => new Map(books.map((book) => [book.id, book])), [books]);
  const activeBooks = activeIds
    .map((id) => byId.get(id))
    .filter((book): book is PickerBook => Boolean(book));

  const availableBooks = useMemo(() => {
    const activeSet = new Set(activeIds);
    const needle = query.trim().toLowerCase();
    return books.filter((book) => {
      if (activeSet.has(book.id)) return false;
      if (!needle) return true;
      return book.title.toLowerCase().includes(needle) || (book.author ?? '').toLowerCase().includes(needle);
    });
  }, [books, activeIds, query]);

  const markDirty = () => {
    setStatus('idle');
    setDirty(true);
  };

  const addBook = (id: string) => {
    setActiveIds((current) => (current.includes(id) ? current : [...current, id]));
    markDirty();
  };

  const removeBook = (id: string) => {
    setActiveIds((current) => current.filter((x) => x !== id));
    markDirty();
  };

  const moveBook = (index: number, delta: number) => {
    setActiveIds((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    markDirty();
  };

  function dropOnActive(event: React.DragEvent, targetIndex: number) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    setDragOverIndex(null);
    setDragId(null);
    if (!id || !byId.has(id)) return;

    setActiveIds((current) => {
      const withoutDragged = current.filter((x) => x !== id);
      const clampedIndex = Math.min(targetIndex, withoutDragged.length);
      return [...withoutDragged.slice(0, clampedIndex), id, ...withoutDragged.slice(clampedIndex)];
    });
    markDirty();
  }

  function dropOnAvailable(event: React.DragEvent) {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    setDragId(null);
    setDragOverIndex(null);
    if (id) removeBook(id);
  }

  function save() {
    startTransition(async () => {
      setError(null);
      const result = await saveShelfBooks(activeIds);
      if (result?.error) {
        setError(result.error);
        setStatus('error');
        return;
      }
      setStatus('saved');
      setDirty(false);
    });
  }

  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <label htmlFor={`${listId}-search`} className="admin-field-label">
            כל הספרים
          </label>
          <input
            id={`${listId}-search`}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש ספר או מחבר…"
            className="admin-field-input mb-3"
          />
          <ul
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropOnAvailable}
            className="max-h-96 space-y-1 overflow-y-auto rounded-[var(--admin-radius-card)] border border-rule p-2"
          >
            {availableBooks.length === 0 ? (
              <li className="px-2 py-6 text-center text-caption text-muted">
                {books.length === activeIds.length ? 'כל הספרים כבר במדף.' : 'אין ספרים תואמים.'}
              </li>
            ) : (
              availableBooks.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  dragging={dragId === book.id}
                  onDragStart={() => setDragId(book.id)}
                  onDragEnd={() => setDragId(null)}
                  actions={
                    <button
                      type="button"
                      onClick={() => addBook(book.id)}
                      className="admin-btn admin-btn-ghost admin-btn-icon shrink-0"
                      aria-label={`הוספת ${book.title} למדף`}
                      title="הוספה למדף"
                    >
                      <AdminIcon name="plus" className="h-4 w-4" />
                    </button>
                  }
                />
              ))
            )}
          </ul>
        </div>

        <div>
          <span className="admin-field-label block">ספרי המדף בעמוד הבית ({activeBooks.length})</span>
          <p className="admin-field-hint mb-3">
            גררו ספרים לכאן, או השתמשו בכפתורי ההוספה/הסרה/סדר. הסדר ברשימה הוא סדר התצוגה במדף. רשימה
            ריקה מציגה את הכותרים האחרונים כברירת מחדל.
          </p>
          <ul
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropOnActive(event, activeBooks.length)}
            className="min-h-24 space-y-1 rounded-[var(--admin-radius-card)] border border-rule p-2"
          >
            {activeBooks.length === 0 ? (
              <li className="px-2 py-6 text-center text-caption text-muted">אין ספרים נבחרים.</li>
            ) : (
              activeBooks.map((book, index) => (
                <BookRow
                  key={book.id}
                  book={book}
                  index={index}
                  dragging={dragId === book.id}
                  dropTarget={dragOverIndex === index && dragId !== book.id}
                  onDragStart={() => setDragId(book.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={() => setDragOverIndex(index)}
                  onDrop={(event) => dropOnActive(event, index)}
                  actions={
                    <>
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
                        disabled={index === activeBooks.length - 1}
                        className="admin-btn admin-btn-ghost admin-btn-icon disabled:opacity-30"
                        aria-label={`איחור ${book.title}`}
                        title="איחור"
                      >
                        <AdminIcon name="chevron-down" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBook(book.id)}
                        className="admin-btn admin-btn-ghost admin-btn-icon"
                        aria-label={`הסרת ${book.title}`}
                        title="הסרה"
                      >
                        <AdminIcon name="x" className="h-4 w-4" />
                      </button>
                    </>
                  }
                />
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
        <button type="button" disabled={pending} onClick={save} className="admin-btn admin-btn-solid">
          {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
          שמירת סדר המדף
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
    </div>
  );
}

function BookRow({
  book,
  index,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  actions,
}: {
  book: PickerBook;
  index?: number;
  dragging: boolean;
  dropTarget?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver?: () => void;
  onDrop?: (event: React.DragEvent) => void;
  actions: React.ReactNode;
}) {
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', book.id);
        event.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={
        onDragOver
          ? (event) => {
              event.preventDefault();
              onDragOver();
            }
          : undefined
      }
      onDrop={onDrop}
      className={`flex cursor-grab items-center gap-3 rounded-[var(--admin-radius-btn)] p-2 transition-colors active:cursor-grabbing ${
        dragging ? 'opacity-40' : ''
      } ${dropTarget ? 'bg-cream-2' : ''}`}
    >
      {index !== undefined ? (
        <span className="w-5 shrink-0 text-center text-caption tabular-nums text-muted">{index + 1}</span>
      ) : null}
      {book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה קטנה בממשק הניהול
        <img src={toCdnUrl(book.coverUrl)} alt="" className="h-10 w-8 shrink-0 rounded-[2px] object-cover" />
      ) : (
        <span className="h-10 w-8 shrink-0 rounded-[2px] bg-cream-2" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-small text-ink">{book.title}</span>
        {book.author ? <span className="block truncate text-caption text-muted">{book.author}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1">{actions}</span>
    </li>
  );
}
