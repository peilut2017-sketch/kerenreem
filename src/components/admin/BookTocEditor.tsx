'use client';

import { useState, useTransition } from 'react';
import { saveBookToc } from '@/lib/admin/actions';
import type { BookTocEntry } from '@/lib/supabase/types';

interface Row {
  key: number;
  title_he: string;
  level: 0 | 1;
  page_number: string;
  summary_he: string;
}

let nextKey = 0;
function makeRow(entry?: Pick<BookTocEntry, 'title_he' | 'level' | 'page_number' | 'summary_he'>): Row {
  nextKey += 1;
  return {
    key: nextKey,
    title_he: entry?.title_he ?? '',
    level: entry?.level === 1 ? 1 : 0,
    page_number: entry?.page_number != null ? String(entry.page_number) : '',
    summary_he: entry?.summary_he ?? '',
  };
}

/**
 * תוכן העניינים של הספר — נשמר בפעולת שרת נפרדת משלו, כי book_toc היא
 * טבלה נפרדת ולא שדה על הספר (ראו saveBookToc ב-actions.ts). הסדר
 * ברשימה כאן הוא סדר התצוגה בעמוד הספר.
 */
export function BookTocEditor({ bookId, entries }: { bookId: string; entries: BookTocEntry[] }) {
  const [rows, setRows] = useState<Row[]>(() => entries.map((entry) => makeRow(entry)));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  function update(key: number, patch: Partial<Row>) {
    setStatus('idle');
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function move(key: number, direction: -1 | 1) {
    setRows((current) => {
      const index = current.findIndex((row) => row.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      setStatus('idle');
      setError(null);
      const result = await saveBookToc(
        bookId,
        rows.map((row) => ({
          title_he: row.title_he,
          level: row.level,
          page_number: row.page_number.trim() === '' ? null : Number(row.page_number),
          summary_he: row.summary_he,
        })),
      );
      if (result?.error) {
        setError(result.error);
        setStatus('error');
      } else {
        setStatus('saved');
      }
    });
  }

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.key} className="grid gap-3 border border-rule p-4 sm:grid-cols-[1fr_7rem_5rem_auto]">
            <label className="block">
              <span className="field-label">כותרת הפרק</span>
              <input
                value={row.title_he}
                onChange={(event) => update(row.key, { title_he: event.target.value })}
                className="field-input mt-1"
              />
            </label>
            <label className="block">
              <span className="field-label">עומק</span>
              <select
                value={row.level}
                onChange={(event) => update(row.key, { level: Number(event.target.value) === 1 ? 1 : 0 })}
                className="field-input mt-1"
              >
                <option value={0}>פרק ראשי</option>
                <option value={1}>תת-פרק</option>
              </select>
            </label>
            <label className="block">
              <span className="field-label">עמוד</span>
              <input
                type="number"
                dir="ltr"
                value={row.page_number}
                onChange={(event) => update(row.key, { page_number: event.target.value })}
                className="field-input mt-1"
              />
            </label>
            <div className="flex items-end gap-2 pb-0.5">
              <button
                type="button"
                onClick={() => move(row.key, -1)}
                disabled={index === 0}
                aria-label="הזזה למעלה"
                className="rounded-[var(--radius-sm)] border border-rule px-2 py-1.5 text-caption disabled:opacity-40"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(row.key, 1)}
                disabled={index === rows.length - 1}
                aria-label="הזזה למטה"
                className="rounded-[var(--radius-sm)] border border-rule px-2 py-1.5 text-caption disabled:opacity-40"
              >
                ↓
              </button>
            </div>
            <label className="block sm:col-span-4">
              <span className="field-label">תקציר הפרק (אופציונלי)</span>
              <textarea
                value={row.summary_he}
                onChange={(event) => update(row.key, { summary_he: event.target.value })}
                rows={2}
                className="field-input mt-1"
              />
            </label>
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              className="text-caption text-burgundy underline underline-offset-4 sm:col-span-4"
            >
              הסרת השורה
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((current) => [...current, makeRow()])}
        className="btn btn-quiet mt-4"
      >
        + הוספת פרק
      </button>

      <div className="mt-5 flex items-center gap-3 border-t border-rule pt-5">
        <button type="button" onClick={save} disabled={pending} className="btn btn-solid">
          {pending ? 'שומר…' : 'שמירת תוכן העניינים'}
        </button>
        {status === 'saved' ? <span className="text-small text-ink-soft">נשמר.</span> : null}
        {error ? (
          <span role="alert" className="text-small text-burgundy">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
