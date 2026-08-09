'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SearchDialog } from './SearchDialog';

/**
 * חיפוש בכותרת.
 *
 * [1.4] לפני התיקון זה היה שדה w-48 קבוע שרק ניווט ל-/books?q=… בלי אף
 * תוצאה חיה (ביקורת המימוש ב.2) — עכשיו כפתור שפותח את SearchDialog,
 * דיאלוג עם תוצאות חיות מקובצות (ספרים/מחברים/קטגוריות) שמנווטות ישירות.
 */
export function SearchLauncher() {
  const t = useTranslations('books');
  const [open, setOpen] = useState(false);
  // מפתח שמתקדם בכל פתיחה: מרכיב מחדש את SearchDialog עם state נקי
  // (שאילתה/תוצאות קודמות), במקום useEffect שמאפס state בתוך אפקט.
  const [instance, setInstance] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInstance((n) => n + 1);
          setOpen(true);
        }}
        aria-label={t('search')}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-ink-soft transition-[background-color,color,transform] duration-300 hover:bg-white/70 hover:text-burgundy active:scale-95"
      >
        <SearchIcon />
      </button>
      <SearchDialog key={instance} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
      <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
