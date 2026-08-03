'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { LocaleSwitch } from './LocaleSwitch';

/**
 * תפריט למסכים צרים. נפתח כלוח מלא, נסגר ב-Escape או בניווט, ומחזיר את
 * המיקוד לכפתור הפותח — התנהגות מקלדת נדרשת בתקן 5568.
 */
export function MobileNav({
  items,
  openLabel,
  closeLabel,
  searchLabel,
}: {
  items: { href: string; label: string }[];
  openLabel: string;
  closeLabel: string;
  searchLabel: string;
}) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');

  // התפריט פתוח רק עבור העמוד שממנו נפתח. ניווט משנה את pathname ולכן
  // סוגר אותו מאליו — בלי useEffect שמאפס state אחרי הרינדור.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const open = openedFor === pathname;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenedFor(null);
        toggleRef.current?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector('a')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpenedFor(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-ink transition-[background-color,color,transform] duration-300 hover:bg-white/70 active:scale-95"
        aria-label={open ? closeLabel : openLabel}
      >
        {open ? (
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
            <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          // fixed ולא absolute: הכפתור יושב היום בתוך משטח שגם רץ בין
          // מצב פתוח לצף וגם overflow-hidden (לגזירת שכבת הזכוכית) —
          // absolute עם top:100% נגד ancestor כזה חישב מיקום שגוי. fixed
          // עם --site-header-h (אותו משתנה שמזין את שאר האתר) עצמאי
          // מהמבנה של ה-header ונכון בשני מצביו.
          className="glass fixed inset-x-0 top-[calc(var(--site-header-h,4.75rem)+0.5rem)] z-40 rounded-[var(--radius-xl)]"
        >
          <div className="mx-auto w-full max-w-[82rem] px-5 py-6 sm:px-6">
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                const q = query.trim();
                router.push(q ? `/books?q=${encodeURIComponent(q)}` : '/books');
                setOpenedFor(null);
              }}
              className="mb-5"
            >
              <label htmlFor="mobile-search" className="sr-only">
                {searchLabel}
              </label>
              <input
                id="mobile-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchLabel}
                className="field-input"
              />
            </form>

            <nav aria-label={openLabel}>
              <ul className="space-y-1">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-[var(--radius-sm)] px-3 py-3 font-serif text-[1.125rem] text-ink transition-[background-color,color] duration-300 hover:bg-white/70 hover:text-burgundy"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-6">
              <LocaleSwitch />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
