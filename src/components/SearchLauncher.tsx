'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/**
 * חיפוש בכותרת.
 *
 * כפתור שנפתח לשדה, ולא שדה קבוע שתופס רוחב בכותרת נמוכה. השליחה מנווטת
 * ל-/books עם פרמטר q, כך שהחיפוש נשאר בכתובת — אפשר לשתף אותו, לחזור
 * אליו, ולסמן אותו כמועדף.
 */
export function SearchLauncher({ onDark = false }: { onDark?: boolean }) {
  const t = useTranslations('books');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query = value.trim();
    router.push(query ? `/books?q=${encodeURIComponent(query)}` : '/books');
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('search')}
        aria-expanded={false}
        className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-pill)] transition-[background-color,color,transform] duration-300 active:scale-95 ${
          onDark
            ? 'text-cream-2/85 hover:bg-white/10 hover:text-gold-bright'
            : 'text-ink-soft hover:bg-white/70 hover:text-burgundy'
        }`}
      >
        <SearchIcon />
      </button>
    );
  }

  return (
    <form onSubmit={submit} role="search" className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t('search')}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-48 rounded-[var(--radius-pill)] border border-rule-strong/70 bg-white/70 px-4 py-2 text-small text-ink outline-none transition-[border-color,box-shadow] duration-300 focus:border-gold-deep focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-gold)_20%,transparent)]"
      />
      <button type="submit" aria-label={t('search')} className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] text-ink-soft transition-colors hover:bg-white/70 hover:text-burgundy">
        <SearchIcon />
      </button>
    </form>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
