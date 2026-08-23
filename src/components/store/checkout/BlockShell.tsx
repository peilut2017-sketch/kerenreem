'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

/**
 * מעטפת בלוק ב-Checkout: כותרת ממוספרת, מצב סגור עם תקציר ו"עריכה",
 * ומצב פתוח עם התוכן. progressive disclosure בלי ניווט בין עמודים.
 */
export function BlockShell({
  index,
  title,
  open,
  done,
  reachable = true,
  summary,
  onOpen,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  done: boolean;
  reachable?: boolean;
  summary?: ReactNode;
  onOpen: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('store');
  const contentRef = useRef<HTMLDivElement>(null);
  const firstOpen = useRef(true);

  // [1.6] העברת מיקוד בין בלוקים (ח.7): כשבלוק נפתח — גלילה חלקה אליו
  // ומיקוד השדה הראשון בתוכו, כדי שלא יהיה צריך לגלול/ללחוץ ידנית.
  //
  // מדולג בפתיחה הראשונה (טעינת העמוד): גלילה + מיקוד אוטומטיים ברגע
  // הכניסה פתחו את המקלדת במובייל מעל חצי מסך, לפני שהלקוח ראה את
  // הסיכום או את "חזרה לסל". המיקוד האוטומטי שמור למעברים יזומים בין
  // בלוקים, שם הוא באמת חוסך לחיצה.
  useEffect(() => {
    if (!open) return;
    if (firstOpen.current) {
      firstOpen.current = false;
      return;
    }
    const node = contentRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // בלי button בבורר: בבלוק הסיכום האלמנט הראשון הוא טוגל "יש לי
    // קופון" — מיקוד שם מדלג על תוכן הסקירה עצמו.
    node.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea')?.focus({ preventScroll: true });
  }, [open]);

  return (
    <section
      aria-labelledby={`checkout-block-${index}`}
      className={`rounded-[var(--radius-lg)] border bg-cream px-5 py-4 shadow-[var(--shadow-soft)] sm:px-7 sm:py-5 ${
        open ? 'border-gold/50' : 'border-rule'
      } ${!reachable ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={`checkout-block-${index}`} className="flex items-center gap-3 font-serif text-h3 text-ink">
          <span
            aria-hidden="true"
            className={`flex h-7 w-7 items-center justify-center rounded-[var(--radius-pill)] text-small ${
              done ? 'bg-gold text-navy' : open ? 'bg-gold/20 text-burgundy ring-2 ring-gold' : 'bg-cream-2 text-ink-soft'
            }`}
          >
            {done ? '✓' : index}
          </span>
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
  );
}
