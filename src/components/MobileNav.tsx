'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { usePathname } from '@/i18n/navigation';
import { LocaleSwitch } from './LocaleSwitch';

/**
 * תפריט למסכים צרים. נפתח כלוח מלא, נסגר ב-Escape או בניווט, ומחזיר את
 * המיקוד לכפתור הפותח — התנהגות מקלדת נדרשת בתקן 5568.
 */
export function MobileNav({
  items,
  donateLabel,
  openLabel,
  closeLabel,
}: {
  items: { href: string; label: string }[];
  donateLabel: string;
  openLabel: string;
  closeLabel: string;
}) {
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // התפריט פתוח רק עבור העמוד שממנו נפתח. ניווט משנה את pathname ולכן
  // סוגר אותו מאליו — בלי useEffect שמאפס state אחרי הרינדור.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const open = openedFor === pathname;
  const setOpen = (next: boolean) => setOpenedFor(next ? pathname : null);

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
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="btn btn-quiet px-3 py-2"
      >
        {open ? closeLabel : openLabel}
      </button>

      {open ? (
        <div
          id="mobile-nav-panel"
          ref={panelRef}
          className="absolute inset-x-0 top-full z-40 border-y border-rule bg-paper"
        >
          <nav aria-label={openLabel} className="mx-auto w-full max-w-[72rem] px-5 py-6 sm:px-8">
            <ul className="divide-y divide-rule">
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="block py-3 text-ink-soft hover:text-burgundy">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-center justify-between gap-4">
              <Link href="/donate" className="btn btn-solid">
                {donateLabel}
              </Link>
              <LocaleSwitch />
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
