'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { localized } from '@/lib/localized';
import { countActiveFilters, type Filters } from '@/lib/book-search';
import type { Author, AttributeWithValues, Tag } from '@/lib/supabase/types';

/**
 * מגירת הסינון.
 *
 * מגירה צפה ולא סרגל צד קבוע — כך החוויה זהה במחשב ובנייד, ואין שני
 * מימושים שצריך לתחזק ולבדוק בנפרד.
 *
 * המגירה היא דיאלוג מודאלי לכל דבר: המיקוד נלכד בתוכה, Escape סוגר,
 * והמיקוד חוזר לכפתור שפתח אותה. בלי לכידת מיקוד, טאב מתוך מגירה פתוחה
 * משוטט בעמוד שמאחוריה — שם קורא מסך ממשיך לקרוא תוכן שוויזואלית מוסתר.
 */
export function FilterDrawer({
  filters,
  onChange,
  authors,
  bindings,
  tags,
  attributes,
  languages,
  years,
  locale,
  storeEnabled,
  maxPrice,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  authors: Author[];
  bindings: string[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  languages: { code: string; label: string }[];
  years: { min: number; max: number } | null;
  locale: string;
  storeEnabled: boolean;
  maxPrice: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [authorQuery, setAuthorQuery] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  const active = countActiveFilters(filters);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    // הכפתור נלכד עכשיו: בזמן הניקוי ה-ref כבר עשוי להצביע למקום אחר,
    // והמיקוד היה חוזר לאלמנט שגוי או לגוף המסמך
    const trigger = triggerRef.current;
    panel?.querySelector<HTMLElement>('input, button, select')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      trigger?.focus();
    };
  }, [open]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleIn = (list: string[], item: string) =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  const visibleAuthors = authorQuery
    ? authors.filter((author) =>
        localized(author, 'name', locale).toLowerCase().includes(authorQuery.toLowerCase()),
      )
    : authors;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="btn btn-quiet inline-flex items-center gap-2"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
          <path d="M3 6h14M6 10h8M9 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        סינון
        {active > 0 ? (
          <span className="rounded-[var(--radius-pill)] bg-burgundy px-1.5 text-caption text-white tabular-nums">
            {active}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="סגירת הסינון"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="glass relative m-3 flex w-full max-w-[24rem] flex-col overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-float)]"
          >
            <div className="flex items-center justify-between border-b border-rule px-6 py-4">
              <h2 id={titleId} className="font-serif text-h3 text-ink">
                סינון
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="rounded-[var(--radius-pill)] p-1.5 text-muted transition-colors hover:text-burgundy"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none">
                  <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              {authors.length > 0 ? (
                <Group title="מחבר">
                  <input
                    type="text"
                    value={authorQuery}
                    onChange={(event) => setAuthorQuery(event.target.value)}
                    placeholder="חיפוש בשמות המחברים"
                    aria-label="חיפוש בשמות המחברים"
                    className="field-input mb-3"
                  />
                  <div className="max-h-52 space-y-1 overflow-y-auto">
                    {visibleAuthors.map((author) => (
                      <Check
                        key={author.id}
                        label={localized(author, 'name', locale)}
                        checked={filters.authors.includes(author.slug)}
                        onChange={() => set('authors', toggleIn(filters.authors, author.slug))}
                      />
                    ))}
                    {visibleAuthors.length === 0 ? (
                      <p className="text-caption text-muted">אין מחבר בשם זה.</p>
                    ) : null}
                  </div>
                </Group>
              ) : null}

              {tags.length > 0 ? (
                <Group title="תגיות">
                  <p className="mb-2 text-caption text-muted">
                    בחירת כמה תגיות מצמצמת: יוצגו רק ספרים שנושאים את כולן.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const selected = filters.tags.includes(tag.slug);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => set('tags', toggleIn(filters.tags, tag.slug))}
                          className={`rounded-[var(--radius-pill)] border px-3 py-1 text-caption transition-colors ${
                            selected
                              ? 'border-burgundy bg-burgundy text-white'
                              : 'border-rule text-ink-soft hover:border-burgundy hover:text-burgundy'
                          }`}
                        >
                          {localized(tag, 'name', locale)}
                        </button>
                      );
                    })}
                  </div>
                </Group>
              ) : null}

              {attributes.map((attribute) => (
                <Group key={attribute.id} title={localized(attribute, 'name', locale)}>
                  {attribute.values.map((value) => (
                    <Check
                      key={value.id}
                      label={localized(value, 'name', locale)}
                      checked={filters.attributeValues.includes(value.id)}
                      onChange={() =>
                        set('attributeValues', toggleIn(filters.attributeValues, value.id))
                      }
                    />
                  ))}
                </Group>
              ))}

              {languages.length > 0 ? (
                <Group title="שפה">
                  {languages.map((language) => (
                    <Check
                      key={language.code}
                      label={language.label}
                      checked={filters.languages.includes(language.code)}
                      onChange={() => set('languages', toggleIn(filters.languages, language.code))}
                    />
                  ))}
                </Group>
              ) : null}

              {bindings.length > 0 ? (
                <Group title="כריכה">
                  {bindings.map((binding) => (
                    <Check
                      key={binding}
                      label={binding}
                      checked={filters.bindings.includes(binding)}
                      onChange={() => set('bindings', toggleIn(filters.bindings, binding))}
                    />
                  ))}
                </Group>
              ) : null}

              {years ? (
                <Group title="שנת הוצאה">
                  <div className="flex items-center gap-3">
                    <NumberField
                      label="משנת"
                      value={filters.yearFrom}
                      min={years.min}
                      max={years.max}
                      onChange={(value) => set('yearFrom', value)}
                    />
                    <NumberField
                      label="עד שנת"
                      value={filters.yearTo}
                      min={years.min}
                      max={years.max}
                      onChange={(value) => set('yearTo', value)}
                    />
                  </div>
                  <p className="mt-2 text-caption text-muted">
                    בקטלוג: {years.min}–{years.max}
                  </p>
                </Group>
              ) : null}

              <Group title="זמינות">
                <Check
                  label="רק ספרים עם דפדוף לדוגמה"
                  checked={filters.withSample}
                  onChange={() => set('withSample', !filters.withSample)}
                />
                <Check
                  label="רק מהדורות רב-כרכיות"
                  checked={filters.multiVolume}
                  onChange={() => set('multiVolume', !filters.multiVolume)}
                />
                <Check
                  label="רק המועדפים שלי"
                  checked={filters.favouritesOnly}
                  onChange={() => set('favouritesOnly', !filters.favouritesOnly)}
                />
                {storeEnabled ? (
                  <Check
                    label="רק ספרים לרכישה"
                    checked={filters.purchasableOnly}
                    onChange={() => set('purchasableOnly', !filters.purchasableOnly)}
                  />
                ) : null}
              </Group>

              {storeEnabled && maxPrice !== null ? (
                <Group title="מחיר">
                  <label className="flex items-center gap-3 text-small text-ink-soft">
                    <span className="whitespace-nowrap">עד</span>
                    <input
                      type="range"
                      min={0}
                      max={maxPrice}
                      step={10}
                      value={filters.priceMax ?? maxPrice}
                      onChange={(event) => set('priceMax', Number(event.target.value))}
                      className="flex-1 accent-[var(--color-burgundy)]"
                    />
                    <span className="w-16 text-end tabular-nums">
                      {filters.priceMax ?? maxPrice} ₪
                    </span>
                  </label>
                </Group>
              ) : null}
            </div>

            <div className="flex items-center gap-3 border-t border-rule px-6 py-4">
              <button type="button" onClick={() => setOpen(false)} className="btn btn-solid flex-1">
                הצגת התוצאות
              </button>
              {active > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...filters,
                      authors: [],
                      bindings: [],
                      tags: [],
                      attributeValues: [],
                      languages: [],
                      yearFrom: null,
                      yearTo: null,
                      multiVolume: false,
                      withSample: false,
                      purchasableOnly: false,
                      favouritesOnly: false,
                      priceMax: null,
                    })
                  }
                  className="text-small text-muted underline underline-offset-4"
                >
                  ניקוי
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="eyebrow mb-3">{title}</legend>
      {children}
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 py-1 text-small text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
      />
      <span>{label}</span>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex-1 text-caption text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value ?? ''}
        placeholder={String(label === 'משנת' ? min : max)}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="field-input mt-1 tabular-nums"
        dir="ltr"
      />
    </label>
  );
}
