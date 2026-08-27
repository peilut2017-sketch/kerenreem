'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** [1.6] משך מעבר הפתיחה/סגירה — משותף לכל הוריאנטים (ח.1, ח.2). */
const TRANSITION_MS = 200;

/**
 * [1.11] ערימת הדיאלוגים הפתוחים — כשדיאלוג נפתח מעל דיאלוג (יצירת מחבר
 * מלאה מעל כרטיס ספר), שניהם מאזינים ל-Escape ברמת document; בלי הערימה
 * לחיצה אחת הייתה סוגרת את שניהם בבת אחת. רק הדיאלוג העליון מגיב
 * ל-Escape וללכידת Tab.
 */
const dialogStack: symbol[] = [];

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
  variant = 'side',
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
  /**
   * 'side' (ברירת מחדל) — פאנל צף מהקצה, למגירות סינון וכדומה.
   * 'center' — דיאלוג ממורכז בעמוד, לתוכן גדול יותר כמו טופס ספר שלם:
   * הצפה מקצה המסך אינה מתאימה לטופס ארוך עם לשוניות, בעוד מרכז העמוד
   * נותן לו את מלוא תשומת הלב, כפי שדיאלוג עריכה מרכזי מצופה להיראות.
   * 'bottom' — עולה מתחתית המסך, לבחירות קצרות במובייל (ח.18): הכיוון
   * האנכי אינו תלוי RTL/LTR, בניגוד להחלקה אופקית מהצד.
   */
  variant?: 'side' | 'center' | 'bottom';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  // [1.6] מעבר פתיחה/סגירה (ח.1): הפאנל נשאר מורכב זמן קצר אחרי open=false
  // כדי שהאנימציה תספיק לרוץ — בלי זה הסגירה "קופצת" בלי מעבר בכלל.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  // פתיחה/סגירה מזוהות במהלך הרינדור עצמו (כמו seenPathname ב-AdminNav.tsx),
  // לא בתוך אפקט — קריאת setState סינכרונית באפקט עלולה לגרום לרינדור
  // מפל (react-hooks/set-state-in-effect); זהו הדפוס הבטוח של React
  // ל"גזירת state ממאפיין שהשתנה". סגירה מקבלת visible=false כבר בפריים
  // הזה (בלי לחכות לאפקט) — מתחילה את מעבר הסגירה מוקדם יותר, לא מאוחר.
  if (open && !mounted) {
    setMounted(true);
  }
  if (!open && visible) {
    setVisible(false);
  }

  // עדכון הפניה בתוך אפקט ולא בגוף הרינדור: כתיבה ל-ref בזמן רינדור
  // אינה בטוחה (React עשוי לקרוא את הרכיב יותר מפעם אחת לפני שהוא
  // מתחייב לתוצאה). האפקט הזה רץ בכל רינדור, כך ש-onKeyDown שבפנים
  // תמיד סוגר עם הגרסה העדכנית של onClose בלי צורך להוסיף אותה לתלויות
  // של אפקט לכידת המיקוד עצמו.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (open) {
      // פריים נפרד כדי שהמעבר יתחיל ממצב סגור אמיתי בדפדפן, לא יתמזג עם ה-mount עצמו
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    const timeout = setTimeout(() => setMounted(false), TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const token = Symbol('drawer');
    dialogStack.push(token);
    const isTop = () => dialogStack[dialogStack.length - 1] === token;

    const panel = panelRef.current;
    const previouslyFocused = returnFocusTo ?? (document.activeElement as HTMLElement | null);
    panel?.querySelector<HTMLElement>('input, button, select, a[href]')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (!isTop()) return;
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
      const index = dialogStack.indexOf(token);
      if (index !== -1) dialogStack.splice(index, 1);
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, returnFocusTo]);

  // [1.32] document עוד לא קיים בזמן ה-SSR של רכיב הלקוח — אין מקרה בפועל
  // שבו mounted=true כבר ברינדור הראשון (כל הקוראים מתחילים עם open=false
  // מקומי), אך התנאי כאן מונע קריסה תיאורטית בלי לסבך את הלוגיקה למעלה.
  if (!mounted || typeof document === 'undefined') return null;

  const centered = variant === 'center';
  const bottom = variant === 'bottom';
  const panelMotion = bottom
    ? `transition-transform duration-200 ease-[var(--ease-spring)] ${visible ? 'translate-y-0' : 'translate-y-full'}`
    : `transition-[opacity,transform] duration-200 ease-[var(--ease-spring)] ${visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`;

  // [1.32] פורטל אל ה-body ולא רינדור במקום: כל אב עם backdrop-filter/
  // transform (כמו .glass — ראו globals.css) הופך container חדש לילדים
  // עם position:fixed לפי מפרט ה-CSS, כך ש-fixed inset-0 כבר לא מכסה את
  // המסך אלא רק את תיבת האב עצמו. זה בדיוק מה שקרה למגירת הסינון: היא
  // מקוננת בתוך סרגל הכלים ה"זכוכית" (Toolbar), ובלי הפורטל הרקע והפאנל
  // נלכדו בגובה הסרגל הצר במקום להיפתח כדיאלוג מסך-מלא.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex ${bottom ? 'items-end justify-center' : centered ? 'items-center justify-center p-4' : 'justify-end'}`}
    >
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        className={`absolute inset-0 bg-navy/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass relative flex w-full ${widthClassName} flex-col overflow-hidden ${
          bottom ? 'rounded-t-[var(--radius-xl)]' : 'rounded-[var(--radius-xl)]'
        } shadow-[var(--shadow-float)] ${
          centered ? 'max-h-[88vh]' : bottom ? 'max-h-[85vh]' : 'm-3'
        } ${panelMotion}`}
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
    </div>,
    document.body,
  );
}
