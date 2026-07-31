'use client';

import { useState } from 'react';

interface TimelineEntry {
  year: string;
  text: string;
}

/**
 * ציר תולדות החיים של המחבר: שנה ומשפט קצר לכל תחנה, מוצג בעמוד הספר
 * כציר זמן אופקי. נשמר כ-jsonb על authors.timeline, לא כטבלה נפרדת —
 * אותו נימוק כמו books.quotes: רשימה קצרה שנערכת כמקשה אחת מתוך טופס
 * המחבר, בלי צורך בסינון או קישור אליה מבחוץ.
 */
export function AuthorTimelineField({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValue?: TimelineEntry[] | null;
}) {
  const [rows, setRows] = useState<TimelineEntry[]>(defaultValue && defaultValue.length > 0 ? defaultValue : []);

  const update = (index: number, patch: Partial<TimelineEntry>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const remove = (index: number) => setRows((current) => current.filter((_, i) => i !== index));

  return (
    <div>
      <span className="field-label">{label}</span>
      {hint ? <span className="field-hint mb-2 block">{hint}</span> : null}

      {rows.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {rows.map((row, index) => (
            <li key={index} className="flex items-start gap-2">
              <input
                type="text"
                value={row.year}
                onChange={(event) => update(index, { year: event.target.value })}
                placeholder="תרי״ט"
                aria-label={`שנה — תחנה ${index + 1}`}
                className="field-input w-28 shrink-0"
              />
              <input
                type="text"
                value={row.text}
                onChange={(event) => update(index, { text: event.target.value })}
                placeholder="נולד בוורבוי, הונגריה"
                aria-label={`תיאור — תחנה ${index + 1}`}
                className="field-input flex-1"
              />
              <button
                type="button"
                onClick={() => remove(index)}
                aria-label={`הסרת תחנה ${index + 1}`}
                className="mt-2 shrink-0 text-caption text-muted transition-colors hover:text-burgundy"
              >
                הסרה
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        onClick={() => setRows((current) => [...current, { year: '', text: '' }])}
        className="mt-2 text-caption text-burgundy underline underline-offset-4"
      >
        + הוספת תחנה
      </button>

      <input type="hidden" name={name} value={JSON.stringify(rows.filter((r) => r.year.trim() || r.text.trim()))} />
    </div>
  );
}
