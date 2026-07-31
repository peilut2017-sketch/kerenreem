'use client';

import { useEffect, useRef } from 'react';

/**
 * מגירה צפה — הפאנל עצמו, בלי הכפתור שפותח אותו.
 *
 * חולץ מ-FilterDrawer כדי לשמש גם את מגירת עריכת הספר: שתיהן זקוקות
 * לאותה התנהגות מודאלית בדיוק (לכידת מיקוד, Escape, לחיצה על הרקע),
 * אבל נבדלות במי שקובע מתי הן פתוחות — כאן זה props.open חיצוני, שם
 * זה state מקומי סביב כפתור. הפרדת הפאנל מהטריגר מאפשרת לשני המקרים
 * לחלוק את אותו קוד בלי לכפות מבנה זהה מסביבו.
 *
 * המגירה היא דיאלוג מודאלי לכל דבר: המיקוד נלכד בתוכה, Escape סוגר, טאב
 * לא בורח החוצה. בלי לכידת מיקוד, טאב מתוך מגירה פתוחה משוטט בעמוד
 * שמאחוריה — שם קורא מסך ממשיך לקרוא תוכן שוויזואלית מוסתר.
 */
export function Drawer({
  open,
  onClose,
  titleId,
  title,
  children,
  footer,
  widthClassName = 'max-w-[24rem]',
  returnFocusTo,
  closeLabel = 'סגירה',
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClassName?: string;
  /** אלמנט שהמיקוד חוזר אליו בסגירה. ברירת המחדל: מה שהיה ממוקד לפני הפתיחה. */
  returnFocusTo?: HTMLElement | null;
  /**
   * כיתוב נגיש לכפתורי הסגירה. ברירת המחדל בעברית משרתת את מסכי הניהול,
   * שהם עברית בלבד; האתר הציבורי מעביר כאן מחרוזת מתורגמת, אחרת קורא מסך
   * באנגלית שומע "סגירה".
   */
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  // עדכון הפניה בתוך אפקט ולא בגוף הרינדור: כתיבה ל-ref בזמן רינדור
  // אינה בטוחה (React עשוי לקרוא את הרכיב יותר מפעם אחת לפני שהוא
  // מתחייב לתוצאה). האפקט הזה רץ בכל רינדור, כך ש-onKeyDown שבפנים
  // תמיד סוגר עם הגרסה העדכנית של onClose בלי צורך להוסיף אותה לתלויות
  // של אפקט לכידת המיקוד עצמו.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    const previouslyFocused = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    panel?.querySelector<HTMLElement>('input, button, select, a[href]')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, returnFocusTo]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className="absolute inset-0 bg-navy/40 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass relative m-3 flex w-full ${widthClassName} flex-col overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-float)]`}
      >
        <div className="flex items-center justify-between border-b border-rule px-6 py-4">
          <h2 id={titleId} className="font-serif text-h3 text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-[var(--radius-pill)] p-1.5 text-muted transition-colors hover:text-burgundy"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none">
              <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? <div className="flex items-center gap-3 border-t border-rule px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
