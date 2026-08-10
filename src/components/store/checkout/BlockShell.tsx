'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

/**
 * מעטפת בלוק ב-Checkout: תא במסילת השלבים (rail) — נקודה ממוספרת
 * וקו מחבר בעמודה הלוגית, וכרטיס עם כותרת, מצב סגור עם תקציר ו"עריכה",
 * ומצב פתוח עם התוכן. progressive disclosure בלי ניווט בין עמודים.
 */
export function BlockShell({
  index,
  title,
  open,
  done,
  reachable = true,
  isLast = false,
  summary,
  onOpen,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  done: boolean;
  reachable?: boolean;
  isLast?: boolean;
  summary?: ReactNode;
  onOpen: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('store');
  const contentRef = useRef<HTMLDivElement>(null);

  // [1.6] העברת מיקוד בין בלוקים (ח.7): כשבלוק נפתח — גלילה חלקה אליו
  // ומיקוד השדה הראשון בתוכו, כדי שלא יהיה צריך לגלול/ללחוץ ידנית.
  useEffect(() => {
    if (!open) return;
    const node = contentRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    node.querySelector<HTMLElement>('input, select, textarea, button')?.focus({ preventScroll: true });
  }, [open]);

  const dotState = done ? 'done' : open ? 'active' : undefined;

  return (
    <li className="rail-item">
      <div className="rail-gutter" aria-hidden="true">
        <span className="rail-dot" data-state={dotState}>
          {done ? <CheckGlyph /> : index}
        </span>
        {!isLast ? <span className="rail-line" data-state={done ? 'done' : undefined} /> : null}
      </div>

      <section
        aria-labelledby={`checkout-block-${index}`}
        className={`rail-card rounded-[var(--radius-lg)] border bg-cream px-5 py-4 shadow-[var(--shadow-soft)] sm:px-7 sm:py-5 ${
          open ? 'border-gold-deep/60' : 'border-rule'
        } ${!reachable ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id={`checkout-block-${index}`} className="font-serif text-h3 text-ink">
            {title}
          </h2>
          {!open && done && reachable ? (
            <button
              type="button"
              onClick={onOpen}
              className="text-small text-muted underline-offset-2 hover:text-burgundy hover:underline"
            >
              {t('edit')}
            </button>
          ) : null}
        </div>

        {!open && done && summary ? <div className="mt-2 text-small text-muted">{summary}</div> : null}
        {open ? (
          <div ref={contentRef} className="mt-5 scroll-mt-24">
            {children}
          </div>
        ) : null}
      </section>
    </li>
  );
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.2 8.4 3.1 3.1L12.8 5" />
    </svg>
  );
}
