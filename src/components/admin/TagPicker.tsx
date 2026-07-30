'use client';

import { useId, useMemo, useState } from 'react';
import type { Tag } from '@/lib/supabase/types';

/**
 * בחירת תגיות עם השלמה ויצירה תוך כדי עריכה.
 *
 * התגיות הנבחרות נשלחות כשדות מוסתרים בשם tag_ids — כך הטופס נשאר טופס
 * רגיל ואינו דורש טיפול מיוחד בשמירה.
 *
 * תגית חדשה נוצרת דרך פעולת שרת ומיד נבחרת. החלופה — לשלוח שם חופשי
 * ולתת לשמירה ליצור — הייתה מייצרת כפילויות בכל שגיאת כתיב: "שבת" ו"שבת "
 * הן שתי תגיות שנראות זהות ברשימה.
 */
export function TagPicker({
  allTags,
  selectedIds,
  onCreate,
}: {
  allTags: Tag[];
  selectedIds: string[];
  /** יוצר תגית חדשה ומחזיר אותה, או null אם היצירה נכשלה */
  onCreate: (name: string) => Promise<Tag | null>;
}) {
  const id = useId();
  const [known, setKnown] = useState(allTags);
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(
    () => known.filter((tag) => selected.includes(tag.id)),
    [known, selected],
  );

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return known
      .filter((tag) => !selected.includes(tag.id) && tag.name_he.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [known, selected, query]);

  const exactExists = known.some(
    (tag) => tag.name_he.trim().toLowerCase() === query.trim().toLowerCase(),
  );

  async function create() {
    const name = query.trim();
    if (!name || exactExists) return;

    setCreating(true);
    setError(null);
    const tag = await onCreate(name);
    setCreating(false);

    if (!tag) {
      setError('יצירת התגית נכשלה. ייתכן שכבר קיימת תגית בשם הזה.');
      return;
    }
    setKnown((current) => [...current, tag]);
    setSelected((current) => [...current, tag.id]);
    setQuery('');
  }

  return (
    <div>
      {/* הערכים שנשלחים בפועל */}
      {selected.map((tagId) => (
        <input key={tagId} type="hidden" name="tag_ids" value={tagId} />
      ))}

      {chosen.length > 0 ? (
        <ul className="mb-3 flex flex-wrap gap-2">
          {chosen.map((tag) => (
            <li key={tag.id}>
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-cream-2 py-1 pe-2 ps-3 text-caption text-ink">
                {tag.name_he}
                <button
                  type="button"
                  onClick={() => setSelected((current) => current.filter((x) => x !== tag.id))}
                  aria-label={`הסרת התגית ${tag.name_he}`}
                  className="text-muted transition-colors hover:text-burgundy"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none">
                    <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <label htmlFor={id} className="field-label">
        הוספת תגית
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={query}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            // Enter בשדה בתוך טופס שולח את הטופס כולו
            if (event.key === 'Enter') {
              event.preventDefault();
              if (suggestions.length > 0) {
                setSelected((current) => [...current, suggestions[0].id]);
                setQuery('');
              } else {
                void create();
              }
            }
          }}
          placeholder="שבת, טהרה, ילדים…"
          className="field-input"
        />
        {query.trim() && !exactExists ? (
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating}
            className="btn btn-quiet whitespace-nowrap"
          >
            {creating ? 'יוצר…' : 'יצירה'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected((current) => [...current, tag.id]);
                  setQuery('');
                }}
                className="rounded-[var(--radius-pill)] border border-rule px-3 py-1 text-caption text-ink-soft transition-colors hover:border-burgundy hover:text-burgundy"
              >
                {tag.name_he}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
