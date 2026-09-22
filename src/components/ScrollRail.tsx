'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * [1.40] רצועה אופקית עם חיצים — מחליפה את `overflow-x-auto` החשוף
 * שהיה בקרוסלות של עמוד הספר (ספרים קשורים, גלריית תמונות).
 *
 * למה לא פס גלילה: פס גלילה אופקי גלוי הוא פקד של מערכת ההפעלה. הוא
 * נראה שונה בכל דפדפן, תופס גובה משלו מתחת לתוכן, ובמסכי מגע הוא לא
 * מופיע בכלל — כך שברוב המקרים לא היה שום סימן שיש עוד תוכן מעבר לקצה.
 *
 * מה שיש במקומו, וזה התקן המקובל היום לרצועות מדיה:
 *  • חיצים עגולים בקצוות, מוצגים רק למי שיש לו עכבר ([@media(hover:hover)]);
 *    במגע ההחלקה עצמה היא הניווט וחץ רק מכסה תוכן.
 *  • כל חץ *נעלם* כשאין לאן לגלול בכיוון שלו — חץ מת הוא הבטחה שבורה.
 *    המדידה חיה: ResizeObserver על הרצועה ועל תוכנה, ומאזין scroll.
 *  • דהיית קצה (mask-image) שמופיעה רק בצד שבו יש עוד תוכן.
 *  • scroll-snap לתחילת פריט, כך שהחלקה לא עוצרת באמצע כרטיס.
 *  • הרצועה עצמה ממוקדת-מקלדת (tabindex=0) עם role="group", וחיצי
 *    המקלדת מדפדפים בה — התנהגות ברירת המחדל של אזור גליל.
 *
 * RTL: לא מחושב ידנית בשום מקום. scrollLeft בכיוון ימין-לשמאל שלילי
 * בדפדפנים מודרניים, והשוואות "האם הגענו לקצה" נעשות על הערך המוחלט —
 * כך אותו קוד עובד בעברית ובאנגלית בלי ענף נפרד לכל אחת.
 */
export function ScrollRail({
  children,
  label,
  prevLabel,
  nextLabel,
  className = '',
  /** כמה מרוחב הרצועה לדלג בלחיצת חץ. */
  pageRatio = 0.8,
}: {
  children: ReactNode;
  label: string;
  prevLabel: string;
  nextLabel: string;
  className?: string;
  pageRatio?: number;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const measure = useCallback(() => {
    const node = rail.current;
    if (!node) return;
    // סף של 2px: חישובי גלילה שבריריים אף פעם לא נוחתים על 0 בדיוק,
    // ובלי הסף החץ היה נשאר דולק בקצה.
    const offset = Math.abs(node.scrollLeft);
    const max = node.scrollWidth - node.clientWidth;
    setAtStart(offset <= 2);
    setAtEnd(max <= 2 || offset >= max - 2);
  }, []);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;
    measure();

    node.addEventListener('scroll', measure, { passive: true });
    // גם על התוכן ולא רק על הרצועה: כרטיסים שמתחלפים (שבב סינון בספרים
    // קשורים) משנים את scrollWidth בלי שגודל הרצועה עצמה השתנה.
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    for (const child of Array.from(node.children)) observer?.observe(child);

    return () => {
      node.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure, children]);

  const page = (direction: 1 | -1) => {
    const node = rail.current;
    if (!node) return;
    const behavior: ScrollBehavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth';
    // ב-RTL הציר הפוך: "קדימה" הוא scrollLeft שיורד. דגימת הסימן של
    // הציר עצמה, במקום לבדוק dir — כך גם מסמך שמשנה כיוון דינמית נכון.
    const rtl = getComputedStyle(node).direction === 'rtl';
    node.scrollBy({ left: (rtl ? -1 : 1) * direction * node.clientWidth * pageRatio, behavior });
  };

  return (
    <div className="relative">
      <RailArrow
        side="start"
        label={prevLabel}
        hidden={atStart}
        onClick={() => page(-1)}
      />
      <RailArrow side="end" label={nextLabel} hidden={atEnd} onClick={() => page(1)} />

      <div
        ref={rail}
        role="group"
        aria-label={label}
        tabIndex={0}
        style={{
          // הדהייה נבנית משני קצוות עצמאיים — הקצה שאין מעברו תוכן
          // נשאר אטום, כדי שלא ייראה כאילו "נחתך" שם משהו.
          maskImage: `linear-gradient(to right, ${atStart ? '#000' : 'transparent'}, #000 3rem, #000 calc(100% - 3rem), ${atEnd ? '#000' : 'transparent'})`,
        }}
        className={`flex snap-x snap-proximity gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] focus-visible:outline-offset-4 motion-reduce:scroll-auto [&>*]:snap-start [&::-webkit-scrollbar]:hidden ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

function RailArrow({
  side,
  label,
  hidden,
  onClick,
}: {
  side: 'start' | 'end';
  label: string;
  hidden: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      tabIndex={hidden ? -1 : 0}
      aria-hidden={hidden || undefined}
      className={`glass absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-[var(--radius-pill)] text-ink-soft shadow-[var(--shadow-soft)] transition-[opacity,color] duration-200 hover:text-burgundy [@media(hover:hover)]:grid ${
        side === 'start' ? '-start-3' : '-end-3'
      } ${hidden ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      {/* אותו נתיב בדיוק לשני הכיוונים, משוקף ב-LTR — הצורה זהה
          לחיצים שכבר קיימים במדף הסדרה, כדי שלא יהיו שני סגנונות. */}
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 ltr:-scale-x-100" fill="none">
        <path
          d={side === 'start' ? 'm8 5 5 5-5 5' : 'm12 5-5 5 5 5'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
