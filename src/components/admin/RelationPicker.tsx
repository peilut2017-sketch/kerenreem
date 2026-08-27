'use client';

import { useId, useMemo, useState } from 'react';
import { QuickCreateOverlay } from './QuickCreateOverlay';

interface NamedEntity {
  id: string;
  name_he: string;
}

/**
 * בחירה מרובה עם השלמה ויצירה תוך כדי עריכה — לכל טבלת-קישור שהצד השני
 * שלה הוא ישות עם id/name_he (תגיות, קטגוריות, ...). [1.21] הוכלל
 * מ-TagPicker הקודם (שהיה ספציפי לתגיות בלבד) כשקטגוריות עברו לאותה
 * חוויית בחירה מרובה — כדי לא לשכפל את כל לוגיקת ההשלמה/היצירה פעם שנייה.
 *
 * הפריטים הנבחרים נשלחים כשדות מוסתרים בשם fieldName — כך הטופס נשאר
 * טופס רגיל ואינו דורש טיפול מיוחד בשמירה.
 *
 * פריט חדש נוצר דרך פעולת שרת ומיד נבחר. החלופה — לשלוח שם חופשי ולתת
 * לשמירה ליצור — הייתה מייצרת כפילויות בכל שגיאת כתיב: "שבת" ו"שבת "
 * הן שתי רשומות שנראות זהות ברשימה.
 */
export function RelationPicker<T extends NamedEntity>({
  fieldName,
  label,
  placeholder,
  itemLabel,
  allItems,
  selectedIds,
  onCreate,
  primaryBadge = false,
  allVisible = false,
  createForm,
}: {
  /** שם שדה ה-input המוסתר שנשלח בטופס (למשל tag_ids) */
  fieldName: string;
  label: string;
  placeholder: string;
  /** שם יחיד לפריט, ל-aria-label של כפתור ההסרה — "תגית"/"קטגוריה" */
  itemLabel: string;
  allItems: T[];
  selectedIds: string[];
  /** יוצר פריט חדש (שם בלבד) ומחזיר אותו, או null אם היצירה נכשלה */
  onCreate: (name: string) => Promise<T | null>;
  /** [1.21] מסמן את הפריט הראשון שנבחר כ"ראשי" — משמעותי לקטגוריות (סדר ה-selected הוא סדר ההגשה, ראו saveEntity), לא לתגיות. */
  primaryBadge?: boolean;
  /**
   * [1.26] רשימה סגורה (כמו קטגוריות) — מציגה את כל הפריטים הקיימים
   * כרשת לחיצה-לבחירה, לא רק חיפוש. לרשימה פתוחה כמו תגיות עדיף חיפוש
   * בלבד: מאות תגיות ברשת אחת הן רעש, לא בחירה מהירה.
   */
  allVisible?: boolean;
  /** [1.26] כרטיס יצירה מלא (כל השדות, כמו CategoryForm) — נפתח ב-overlay מעל הטופס, בנוסף ליצירה המהירה בשם בלבד. */
  createForm?: React.ReactNode;
}) {
  const id = useId();
  const [known, setKnown] = useState(allItems);
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullFormOpen, setFullFormOpen] = useState(false);

  // סדר selected (לא known) — הוא הסדר שנשלח בפועל בטופס, ולכן גם סדר
  // התצוגה חייב לשקף אותו כשprimaryBadge פעיל, אחרת "הראשון שנבחר"
  // בהערה למעלה לא תואם למה שמוצג כראשון בפועל.
  const chosen = useMemo(() => {
    const byId = new Map(known.map((item) => [item.id, item]));
    return selected.map((itemId) => byId.get(itemId)).filter((item): item is T => Boolean(item));
  }, [known, selected]);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return known
      .filter((item) => !selected.includes(item.id) && item.name_he.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [known, selected, query]);

  const exactExists = known.some(
    (item) => item.name_he.trim().toLowerCase() === query.trim().toLowerCase(),
  );

  function toggle(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((x) => x !== itemId) : [...current, itemId],
    );
  }

  async function create() {
    const name = query.trim();
    if (!name || exactExists) return;

    setCreating(true);
    setError(null);
    const item = await onCreate(name);
    setCreating(false);

    if (!item) {
      setError(`היצירה נכשלה. ייתכן ש${itemLabel} בשם הזה כבר קיימ/ת.`);
      return;
    }
    setKnown((current) => [...current, item]);
    setSelected((current) => [...current, item.id]);
    setQuery('');
  }

  return (
    <div>
      {/* הערכים שנשלחים בפועל */}
      {selected.map((itemId) => (
        <input key={itemId} type="hidden" name={fieldName} value={itemId} />
      ))}

      {allVisible ? (
        <>
          <p className="field-label">{label}</p>
          <ul role="list" className="flex flex-wrap gap-2">
            {known.map((item) => {
              const isSelected = selected.includes(item.id);
              const isPrimary = primaryBadge && isSelected && chosen[0]?.id === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-3 py-1.5 text-caption transition-colors ${
                      isSelected
                        ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white'
                        : 'border-rule-strong bg-white text-ink-soft hover:border-[var(--admin-accent)] hover:text-[var(--admin-accent)]'
                    }`}
                  >
                    {isPrimary ? (
                      <span
                        className="rounded-[var(--radius-pill)] bg-white/25 px-1.5 py-0.5 text-[0.65rem] font-semibold"
                        title="הקטגוריה הראשית — מופיעה בכרטיס ובכתובת"
                      >
                        ראשית
                      </span>
                    ) : null}
                    {item.name_he}
                  </button>
                </li>
              );
            })}
          </ul>

          {createForm ? (
            <button
              type="button"
              onClick={() => setFullFormOpen(true)}
              className="btn btn-quiet mt-3"
            >
              + {itemLabel} חדשה
            </button>
          ) : null}
        </>
      ) : (
        <>
          {chosen.length > 0 ? (
            <ul className="mb-3 flex flex-wrap gap-2">
              {chosen.map((item, index) => (
                <li key={item.id}>
                  <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-cream-2 py-1 pe-2 ps-3 text-caption text-ink">
                    {primaryBadge && index === 0 ? (
                      <span
                        className="rounded-[var(--radius-pill)] bg-[var(--admin-accent-soft)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--admin-accent)]"
                        title="הקטגוריה הראשית — מופיעה בכרטיס ובכתובת"
                      >
                        ראשית
                      </span>
                    ) : null}
                    {item.name_he}
                    <button
                      type="button"
                      onClick={() => setSelected((current) => current.filter((x) => x !== item.id))}
                      aria-label={`הסרת ${itemLabel} ${item.name_he}`}
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
            {label}
          </label>
        </>
      )}

      <div className="mt-2 flex gap-2">
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
          placeholder={allVisible ? `חיפוש ${itemLabel}…` : placeholder}
          className="field-input"
        />
        {query.trim() && !exactExists ? (
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating}
            className="btn btn-quiet whitespace-nowrap"
          >
            {creating ? 'יוצר…' : 'יצירה מהירה'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}

      {!allVisible && suggestions.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestions.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected((current) => [...current, item.id]);
                  setQuery('');
                }}
                className="rounded-[var(--radius-pill)] border border-rule px-3 py-1 text-caption text-ink-soft transition-colors hover:border-burgundy hover:text-burgundy"
              >
                {item.name_he}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {createForm ? (
        <QuickCreateOverlay
          title={`${itemLabel} חדשה`}
          open={fullFormOpen}
          onClose={() => setFullFormOpen(false)}
          onCreated={(itemId, name) => {
            setKnown((current) =>
              current.some((item) => item.id === itemId)
                ? current
                : [...current, { id: itemId, name_he: name ?? '(נוצר עתה)' } as T],
            );
            setSelected((current) => (current.includes(itemId) ? current : [...current, itemId]));
          }}
        >
          {createForm}
        </QuickCreateOverlay>
      ) : null}
    </div>
  );
}
