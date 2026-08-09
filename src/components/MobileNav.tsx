'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleSwitch } from './LocaleSwitch';
import { SearchDialog } from './SearchDialog';

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
  const [searchOpen, setSearchOpen] = useState(false);
  // מפתח שמתקדם בכל פתיחה — מרכיב מחדש את SearchDialog עם state נקי,
  // כמו ב-SearchLauncher.
  const [searchInstance, setSearchInstance] = useState(0);

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

      {/*
        תמיד ב-DOM, לא mount/unmount על open — כדי שתהיה אנימציית סגירה
        בכלל (אלמנט שמוסר מיד אינו יכול "לדעוך", רק להיעלם בבת אחת).
        המעבר עצמו הוא opacity+transform, כמו שאר אתר הבית — לא ספרייה
        חיצונית, רק כדי שיישאר קליל לתפריט שנפתח ונסגר הרבה.
        inert כשסגור: גם מוציא מסדר הטאב וגם מסתיר מקורא מסך, בלי שכפול
        לוגיקה מול opacity/pointer-events (נתמך באופן טבעי מ-React 19).
      */}
      <div
        id="mobile-nav-panel"
        ref={panelRef}
        inert={!open}
        // fixed ולא absolute: הכפתור יושב היום בתוך משטח שגם רץ בין
        // מצב פתוח לצף וגם overflow-hidden (לגזירת שכבת הזכוכית) —
        // absolute עם top:100% נגד ancestor כזה חישב מיקום שגוי. fixed
        // עם --site-header-h (אותו משתנה שמזין את שאר האתר) עצמאי
        // מהמבנה של ה-header ונכון בשני מצביו.
        className={`glass fixed inset-x-0 top-[calc(var(--site-header-h,4.75rem)+0.5rem)] z-40 origin-top rounded-[var(--radius-xl)] transition-[opacity,transform] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none ${
          open ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-[0.97] opacity-0'
        }`}
      >
        <div className="mx-auto w-full max-w-[82rem] px-5 py-6 sm:px-6">
          {/* [1.4] היה שדה שרק ניווט ל-/books?q=… בלי אף תוצאה חיה — עותק
              שלישי של אותה בעיה (ראו SearchLauncher/SearchDialog). עכשיו
              כפתור שפותח את אותו דיאלוג חיפוש עם תוצאות חיות ממשיות. */}
          <button
            type="button"
            onClick={() => {
              setOpenedFor(null);
              setSearchInstance((n) => n + 1);
              setSearchOpen(true);
            }}
            className="field-input mb-5 flex w-full items-center gap-2 text-start text-muted"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path d="m13.5 13.5 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            {searchLabel}
          </button>

          <nav aria-label={openLabel}>
            <ul className="space-y-1">
              {items.map((item, index) => (
                <li
                  key={item.href}
                  className={`transition-[opacity,transform] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none motion-reduce:transform-none ${
                    open ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                  }`}
                  style={{ transitionDelay: open ? `${40 + index * 30}ms` : '0ms' }}
                >
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

      <SearchDialog key={searchInstance} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
