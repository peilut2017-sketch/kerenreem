'use client';

import { useState, useTransition } from 'react';
import { saveBookCost } from '@/lib/admin/costs-actions';
import { AdminIcon } from './AdminIcons';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';

/**
 * עלות ליחידה — פאנל נפרד מטופס הספר בכוונה (מודל 3.18): נטען ונשמר
 * בהרשאת עלויות בלבד, כך שעורך תוכן ומוכרן אינם רואים אותו כלל. הערך
 * יושב ב-book_costs הפרטית, לא ב-books הציבורית.
 */
export function BookCostPanel({
  bookId,
  initialCost,
}: {
  bookId: string;
  initialCost: number | null;
}) {
  const [value, setValue] = useState(initialCost != null ? String(initialCost) : '');
  const [saved, setSaved] = useState<number | null>(initialCost);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = (value === '' ? null : Number(value)) !== saved;
  useUnsavedChangesWarning(dirty);

  return (
    <section aria-labelledby="cost-heading" className="admin-card mt-8 max-w-xl">
      <h2 id="cost-heading" className="flex items-center gap-2 text-small font-bold text-ink">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
          <AdminIcon name="finance" className="h-4 w-4" />
        </span>
        עלות ליחידה (פנימי)
      </h2>
      <p className="mt-2 text-caption text-muted">
        עלות הדפסה/רכש ליחידה, ללא מע״מ — מזינה את דוחות הרווחיות. נראית למנהלים בלבד
        ולעולם אינה מוצגת באתר. הזמנות עבר שומרות את העלות שהייתה בעת ההזמנה.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const next = value.trim() === '' ? null : Number(value);
          if (next != null && (!Number.isFinite(next) || next < 0)) {
            setError('ערך לא תקין');
            return;
          }
          startTransition(async () => {
            const result = await saveBookCost(bookId, next);
            if (result.ok) {
              setSaved(next);
              setError(null);
            } else {
              setError(result.error ?? 'השמירה נכשלה');
            }
          });
        }}
        className="mt-4 flex items-end gap-3"
      >
        <div>
          <label htmlFor="book-cost" className="admin-field-label">
            עלות בש״ח
          </label>
          <input
            id="book-cost"
            type="number"
            dir="ltr"
            min={0}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ללא עלות"
            className="admin-field-input w-36"
          />
        </div>
        <button type="submit" disabled={pending || !dirty} className="admin-btn admin-btn-solid">
          {pending ? 'שומר…' : 'שמירה'}
        </button>
        {!dirty && saved != null ? (
          <span className="pb-2 text-caption text-muted">נשמר ✓</span>
        ) : null}
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-caption text-burgundy">
          {error}
        </p>
      ) : null}
    </section>
  );
}
