import type Lenis from 'lenis';

/**
 * שכבת הגלילה האחידה של האתר והניהול.
 *
 * כל קוד שמזיז את העמוד (קפיצה לעוגן, חזרה לראש, פתיחת חלון שננעל) עובר
 * מכאן — ולא ישירות דרך scrollIntoView / window.scrollTo / body.style.overflow.
 * הסיבה: כש-Lenis פעיל הוא מחזיק את מיקוד הגלילה ה"אמיתי" ביעד משלו, וקריאה
 * ישירה לדפדפן נלחמת בו (קפיצה, רעידה, או גלילה שחוזרת אחורה). כשהוא כבוי —
 * בקופה, בהפחתת תנועה, בלי JS — אותן הפונקציות נופלות לגלילה הנייטיבית, כך
 * שהקוראים לא צריכים לדעת באיזה מצב הם נמצאים.
 *
 * scripts/check-scroll-areas.mjs אוכף את זה: קריאה ישירה אסורה מחוץ לקובץ הזה.
 */

let active: Lenis | null = null;
let lockCount = 0;
let savedOverflow = '';

/** נקרא רק מ-SmoothScroll: רושם (או מנקה) את המופע הפעיל. */
export function setActiveLenis(instance: Lenis | null): void {
  active = instance;
  // חלון שנפתח לפני שהספרייה סיימה להיטען חייב להישאר נעול
  if (instance && lockCount > 0) instance.stop();
}

/** מתאם את Lenis אחרי שגובה התוכן או הנתיב השתנו. */
export function resizeSmoothScroll(): void {
  active?.resize();
}

/**
 * האם מותר להפעיל תנועת גלילה. שני מקורות: העדפת המערכת, והמתג
 * "הפחתת תנועה" בווידג׳ט הנגישות (data-a11y-motion על <html>).
 */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return document.documentElement.getAttribute('data-a11y-motion') !== 'on';
}

/**
 * אזורים שבהם גלגלת העכבר שייכת לאלמנט עצמו ולא לעמוד.
 *
 * Lenis קורא לפונקציה הזו על כל אלמנט במסלול האירוע. data-lenis-prevent
 * מסומן ידנית על אזורי גלילה עם overflow, והכלל כאן הוא רשת ביטחון לאלה
 * שאי אפשר לסמן בקוד: שדות טקסט, עורך עשיר, ורכיבים שנפתחים כחלון.
 */
export function preventNestedScroll(node: HTMLElement): boolean {
  const tag = node.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (node.isContentEditable) return true;
  const role = node.getAttribute('role');
  return role === 'dialog' || role === 'alertdialog' || role === 'listbox' || role === 'menu';
}

/** גלילת העמוד למיקום מוחלט. */
export function scrollToY(top: number, options: { immediate?: boolean } = {}): void {
  const target = Math.max(0, top);
  const immediate = options.immediate === true || !motionAllowed();
  if (active) {
    active.scrollTo(target, { immediate });
    return;
  }
  window.scrollTo({ top: target, behavior: immediate ? 'instant' : 'smooth' });
}

export function scrollToTop(): void {
  scrollToY(0);
}

/**
 * גלילה לאלמנט, בכבוד ל-scroll-margin-top שלו ול-scroll-padding-top של
 * העמוד — אותם ערכים ש-scrollIntoView קורא, ושה-CSS של האתר כבר מגדיר
 * (ראו scroll-mt ב-SectionHeading) כדי שהכותרת הדביקה לא תכסה את היעד.
 */
export function scrollToElement(
  target: Element | string,
  options: { block?: 'start' | 'center'; immediate?: boolean } = {},
): void {
  const element = typeof target === 'string' ? document.getElementById(target) : target;
  if (!element) return;

  const rect = element.getBoundingClientRect();
  let top: number;
  if (options.block === 'center') {
    top = rect.top + window.scrollY - (window.innerHeight - rect.height) / 2;
  } else {
    const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    top = rect.top + window.scrollY - margin - padding;
  }
  scrollToY(top, { immediate: options.immediate });
}

/**
 * נעילת גלילת העמוד בזמן שחלון מודאלי פתוח. נעילות מקוננות נספרות, והעמוד
 * משתחרר רק כשהאחרונה שוחררה. מחזירה פונקציית שחרור (בטוחה לקריאה כפולה),
 * שמתאימה ישר להחזרה מתוך useEffect.
 */
export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  if (lockCount === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    active?.stop();
  }
  lockCount += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount -= 1;
    if (lockCount === 0) {
      document.body.style.overflow = savedOverflow;
      active?.start();
    }
  };
}
