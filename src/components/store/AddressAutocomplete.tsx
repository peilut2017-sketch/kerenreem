'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * [1.3] שדה עם השלמה חיה מול מרשם הכתובות הממשלתי: מקליד → הצעות →
 * בחירה בעכבר/מקלדת. נשאר שדה טקסט רגיל לכל דבר — כשל רשת או כתובת
 * שאינה במרשם אינם חוסמים; ‏combobox נגיש (aria-expanded/activedescendant).
 */
export function AddressAutocomplete({
  id,
  value,
  onChange,
  fetcher,
  disabled,
  required,
  autoComplete,
  invalid,
  className,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  fetcher: (query: string) => Promise<string[]>;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const requestId = useRef(0);
  const chosen = useRef<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim();
    // אחרי בחירה מהרשימה אין מה להציע שוב עד הקלדה חדשה
    if (q.length < 2 || q === chosen.current) {
      setOptions([]);
      setOpen(false);
      return;
    }
    const requestNumber = ++requestId.current;
    const timer = setTimeout(async () => {
      const results = await fetcher(q);
      if (requestId.current !== requestNumber) return;
      setOptions(results);
      setOpen(results.length > 0);
      setHighlight(-1);
    }, 220);
    return () => clearTimeout(timer);
  }, [value, fetcher]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function choose(option: string) {
    chosen.current = option;
    onChange(option);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        // ‏open אמת רק כשיש אפשרויות (ראו setOpen), וה-listbox מרונדר רק
        // אז. aria-controls/activedescendant חייבים להיות מותנים ב-open,
        // אחרת כשסגור הם מצביעים ל-id שאינו ב-DOM — aria-valid-attr-value.
        aria-controls={open ? `${id}-list` : undefined}
        aria-activedescendant={open && highlight >= 0 ? `${id}-opt-${highlight}` : undefined}
        aria-invalid={invalid || undefined}
        value={value}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => {
          chosen.current = null;
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter' && highlight >= 0) {
            e.preventDefault();
            choose(options[highlight]);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={className}
      />
      {open ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-[var(--radius-md)] border border-rule bg-white shadow-[var(--shadow-float)]"
        >
          {options.map((option, index) => (
            <li key={option} id={`${id}-opt-${index}`} role="option" aria-selected={index === highlight}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setHighlight(index)}
                className={`block w-full px-4 py-2 text-start text-small ${
                  index === highlight ? 'bg-gold/15 text-ink' : 'text-ink-soft'
                }`}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
