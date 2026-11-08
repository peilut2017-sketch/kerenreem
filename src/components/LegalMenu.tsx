'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { CookieSettingsButton } from './CookieConsentBanner';

/**
 * תפריט המידע המשפטי שבפוטר: תקנון, מדיניות פרטיות, הצהרת נגישות והגדרות
 * עוגיות. כפתור אחד שנפתח כלוח זכוכית חצי שקוף (אותה שפה כמו תפריט הנייד)
 * כלפי מעלה, כי הפוטר בתחתית העמוד.
 *
 * התנהגות מקלדת כמו MobileNav (תקן 5568): Escape סוגר ומחזיר מיקוד לכפתור,
 * המיקוד עובר לפריט הראשון בפתיחה, ולחיצה מחוץ ללוח סוגרת. ניווט סוגר
 * מאליו — ‎openedFor === pathname‎, בלי useEffect שמאפס state.
 */
export interface LegalMenuItem {
  href: string;
  label: string;
}

export function LegalMenu({
  label,
  items,
  cookieLabel,
}: {
  label: string;
  items: LegalMenuItem[];
  cookieLabel: string;
}) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpenedFor(null);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const itemClass =
    'block w-full rounded-[var(--radius-sm)] px-3 py-2.5 text-start text-small text-ink transition-[background-color,color] duration-300 hover:bg-white/70 hover:text-burgundy focus-visible:bg-white/70';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpenedFor(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="footer-legal-menu"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-pill)] border border-white/15 px-3.5 text-caption text-cream-2/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold motion-reduce:transform-none"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
          <path
            d="M5.5 2.75h6.25L15 6v11.25H5.5V2.75Zm6 0V6.25H15M8 10h4.5M8 13h4.5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label}
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform duration-300 motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
        >
          <path d="m5 12 5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* תמיד ב-DOM כדי שתהיה אנימציית סגירה; inert כשסגור מוציא אותו מסדר
          הטאב וממקרא המסך (ראו הערה זהה ב-MobileNav). הלוח הוא זכוכית
          בהירה (‎.glass‎, כמו תפריט הנייד) ולא כהה: הוא נפתח כלפי מעלה, מעל
          תוכן העמוד הבהיר, ושם ‎.glass-dark‎ נשטף לאפור ופוגע בניגודיות.
          עטיפה חיצונית למיקום (במרכז בנייד, בקצה ב-sm+) ופנימית לאנימציה —
          כדי שה-translate של המיקום לא יתנגש ב-translate של המעבר. */}
      <div
        className="absolute bottom-full start-1/2 z-40 mb-2.5 -translate-x-1/2 rtl:translate-x-1/2 sm:start-auto sm:end-0 sm:translate-x-0 sm:rtl:translate-x-0"
      >
      <div
        id="footer-legal-menu"
        ref={panelRef}
        inert={!open}
        className={`glass w-56 origin-bottom rounded-[var(--radius-lg)] p-1.5 transition-[opacity,transform] duration-[360ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none ${
          open ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.96] opacity-0'
        }`}
      >
        <nav aria-label={label}>
          <ul>
            {items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={itemClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-rule pt-1">
              <CookieSettingsButton
                label={cookieLabel}
                className={itemClass}
                onActivate={() => setOpenedFor(null)}
              />
            </li>
          </ul>
        </nav>
      </div>
      </div>
    </div>
  );
}
