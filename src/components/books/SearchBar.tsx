'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { normalise, matches } from '@/lib/book-search';
import { useLocalList } from '@/lib/client-hooks';
import { localized } from '@/lib/localized';
import type { Author, BookWithRelations, Category } from '@/lib/supabase/types';

const RECENT_KEY = 'kr:recent-searches';
const MAX_RECENT = 6;

export interface Suggestion {
  kind: 'book' | 'author' | 'category' | 'recent';
  label: string;
  value: string;
}

/**
 * שורת החיפוש הראשית של הקטלוג.
 *
 * ממומשת כ-combobox לפי תבנית ARIA: השדה נושא aria-expanded ו-aria-controls,
 * הרשימה היא listbox, והפריט הפעיל מסומן ב-aria-activedescendant במקום
 * להעביר אליו מיקוד. כך החצים עובדים בלי שהמיקוד יעזוב את השדה, וההקלדה
 * ממשיכה כרגיל — זו ההתנהגות שמשתמשי קורא מסך מצפים לה מחיפוש.
 *
 * ההצעות נגזרות מהקטלוג עצמו ולא מרשימה כתובה מראש: הצעה למונח שאין לו
 * ולו ספר אחד היא הבטחה שהאתר לא יכול לקיים.
 */
export function SearchBar({
  value,
  onChange,
  books,
  authors,
  categories,
  corpora,
  locale,
  placeholder,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  books: BookWithRelations[];
  authors: Author[];
  categories: Category[];
  corpora: Map<string, string>;
  locale: string;
  placeholder: string;
  label: string;
}) {
  const t = useTranslations('books');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { list: recent, push } = useLocalList(RECENT_KEY);

  const remember = (term: string) => push(term, MAX_RECENT);

  const suggestions = useMemo<Suggestion[]>(() => {
    const needle = value.trim();

    // שדה ריק — מציעים את מה שכבר חיפשו, ואז קטגוריות כנקודת פתיחה
    if (!needle) {
      return [
        ...recent.map((term) => ({ kind: 'recent' as const, label: term, value: term })),
        ...categories.slice(0, 6).map((category) => ({
          kind: 'category' as const,
          label: localized(category, 'name', locale),
          value: localized(category, 'name', locale),
        })),
      ].slice(0, 8);
    }

    const out: Suggestion[] = [];

    for (const author of authors) {
      const name = localized(author, 'name', locale);
      if (matches(normalise(name), needle)) {
        out.push({ kind: 'author', label: name, value: name });
      }
      if (out.length >= 3) break;
    }

    for (const category of categories) {
      const name = localized(category, 'name', locale);
      if (matches(normalise(name), needle)) {
        out.push({ kind: 'category', label: name, value: name });
      }
      if (out.length >= 5) break;
    }

    for (const book of books) {
      if (out.length >= 8) break;
      if (matches(corpora.get(book.id) ?? '', needle)) {
        const title = localized(book, 'title', locale);
        out.push({ kind: 'book', label: title, value: title });
      }
    }

    return out;
  }, [value, recent, authors, categories, books, corpora, locale]);

  // סגירה בלחיצה מחוץ לרכיב
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function choose(suggestion: Suggestion) {
    onChange(suggestion.value);
    remember(suggestion.value);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!open || suggestions.length === 0) {
      if (event.key === 'ArrowDown') setOpen(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      if (active >= 0) {
        event.preventDefault();
        choose(suggestions[active]);
      } else {
        remember(value);
        setOpen(false);
      }
    }
  }

  const listId = `${id}-list`;
  // ה-listbox מרונדר רק כשהוא פתוח *ויש* הצעות. aria-expanded ו-
  // aria-controls חייבים להתייחס למצב הזה בלבד: אחרת, בחיפוש בלי תוצאות
  // (או קטלוג ריק), aria-expanded=true ו-aria-controls מצביע ל-id שלא
  // קיים ב-DOM — הפרה של aria-valid-attr-value (axe critical).
  const listboxVisible = open && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <div className="glass flex h-[3.75rem] items-center gap-3 rounded-[var(--radius-pill)] px-5 shadow-[var(--shadow-float)] focus-within:ring-2 focus-within:ring-gold/60">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5 shrink-0 text-muted" fill="none">
          <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={listboxVisible}
          aria-controls={listboxVisible ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={listboxVisible && active >= 0 ? `${id}-option-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-body text-ink outline-none placeholder:text-muted"
        />

        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setActive(-1);
            }}
            aria-label={t('clearSearch')}
            className="shrink-0 rounded-[var(--radius-pill)] p-1 text-muted transition-colors hover:text-burgundy"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
              <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {listboxVisible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="glass absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 max-h-80 overflow-y-auto rounded-[var(--radius-lg)] p-1.5 shadow-[var(--shadow-float)]"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.kind}-${suggestion.value}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              onPointerDown={(event) => {
                // pointerdown ולא click: blur של השדה סוגר את הרשימה לפני
                // ש-click מספיק לרוץ
                event.preventDefault();
                choose(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2 text-small ${
                index === active ? 'bg-white/70 text-burgundy' : 'text-ink-soft'
              }`}
            >
              <SuggestionIcon kind={suggestion.kind} />
              <span className="flex-1">{suggestion.label}</span>
              <span className="text-caption text-muted">{KIND_LABEL[suggestion.kind]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  book: 'ספר',
  author: 'מחבר',
  category: 'קטגוריה',
  recent: 'חיפוש אחרון',
};

function SuggestionIcon({ kind }: { kind: Suggestion['kind'] }) {
  const paths: Record<Suggestion['kind'], string> = {
    book: 'M5 3h8a1 1 0 0 1 1 1v12l-5-2.5L4 16V4a1 1 0 0 1 1-1Z',
    author: 'M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 17a6 6 0 0 1 12 0',
    category: 'M4 6h12M4 10h12M4 14h7',
    recent: 'M10 5v5l3 2M17 10a7 7 0 1 1-7-7',
  };

  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" fill="none">
      <path d={paths[kind]} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
