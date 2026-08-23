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
      let results: string[];
      try {
        results = await fetcher(q);
      } catch {
        // כשל רשת אינו חוסם את ההקלדה — פשוט אין הצעות. בלי ה-catch זו
        // הייתה unhandled rejection והרשימה נשארה תקועה על המצב הקודם.
        results = [];
      }
      if (requestId.current !== requestNumber) return;
      setOptions(results);
      setOpen(results.length > 0);
      // ההצעה הראשונה מודגשת מראש (דפוס combobox מקובל): Enter בוחר
      // אותה במקום ליפול אל שליחת הטופס העוטף.
      setHighlight(results.length > 0 ? 0 : -1);
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
        aria-controls={`${id}-list`}
        aria-activedescendant={highlight >= 0 ? `${id}-opt-${highlight}` : undefined}
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
          if (!open) {
            // חץ למטה פותח מחדש רשימה שנסגרה ב-Escape — בלי למחוק ולהקליד שוב
            if (e.key === 'ArrowDown' && options.length > 0) {
              e.preventDefault();
              setOpen(true);
              setHighlight(0);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight((h) => Math.min(h + 1, options.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight((h) => Math.max(h - 1, 0));
          } else if (e.key === 'Enter') {
            // כשהרשימה פתוחה Enter לעולם אינו שולח את הטופס העוטף:
            // בלי preventDefault גורף, Enter בלי הדגשה שלח את טופס
            // האספקה עם עיר חלקית ("תל אב") — והשרת קיבל אותה.
            e.preventDefault();
            if (highlight >= 0) choose(options[highlight]);
            else if (options.length === 1) choose(options[0]);
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
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-rule bg-white shadow-[var(--shadow-float)]"
        >
          {/* ה-option עצמו הוא היעד הלחיץ — button בתוך option הוא מבנה
              ARIA אסור (option אינו רשאי להכיל אלמנט אינטראקטיבי), וקוראי
              מסך הכריזו אותו פעמיים או דילגו עליו. */}
          {options.map((option, index) => (
            <li
              key={option}
              id={`${id}-opt-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(option);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`cursor-pointer px-4 py-2 text-start text-small ${
                index === highlight ? 'bg-gold/15 text-ink' : 'text-ink-soft'
              }`}
            >
              {option}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
