'use client';

import { useEffect, useRef, useState } from 'react';

/** גלילה שמפעילה מצב צף, וגלילה שחוזרת ממנו — לא אותו סף. */
const ENTER_FLOAT_AT = 64;
const EXIT_FLOAT_AT = 24;

/** חלון האינטרפולציה של המעבר הרציף: 0 בראש העמוד, 1 מ-96px ומטה. */
const PROGRESS_START = 4;
const PROGRESS_RANGE = 92;

/**
 * מצב הניווט: expanded (משולב בראש העמוד) או floating (קפסולה צפה).
 *
 * Hysteresis בכוונה: סף אחד לכניסה למצב צף ואחר, נמוך ממנו, לחזרה
 * ממנו. בלי זה, גלילה שנעצרת בול על סף בודד גורמת למצב להבהב קדימה
 * ואחורה בכל פיקסל נוסף.
 *
 * [1.11] המעבר עצמו רציף וצמוד-גלילה, לא קפיצה בינארית: הפרוגרס
 * (0..1) נכתב ישירות כמשתנה CSS ‏--hp על אלמנט הכותרת (בלי setState —
 * בלי רינדור React לכל פריים גלילה), וכל מאפייני המראה (ריפוד, רוחב,
 * עיגול פינות, שקיפויות הזכוכית) נגזרים ממנו ב-calc (ראו globals.css,
 * ‎.site-header-*). כך ההיאספות לקפסולה מרגישה כמו מחווה ישירה —
 * בדומה למעבר לתוך אפליקציה — ולא כהחלפת מצב. isFloating הבינארי נשאר
 * רק להחלפות תוכן דיסקרטיות (לוגו קומפקטי, צפיפות קישורים).
 *
 * ניגודיות גבוהה: זכוכית מעל תמונת רקע כלשהי (הבאנר בעמוד הבית, למשל)
 * אינה מבטיחה ניגודיות תקינה, ולכן במצב הזה הניווט נשאר תמיד "צף"
 * (אטום, עם מסגרת) בלי תלות בגלילה בפועל.
 */
export function useHeaderState() {
  const [isFloating, setIsFloating] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const highContrastRef = useRef(false);

  useEffect(() => {
    const html = document.documentElement;
    const sync = () => {
      const on = html.getAttribute('data-a11y-contrast') === 'on';
      highContrastRef.current = on;
      setHighContrast(on);
      if (on) headerRef.current?.style.setProperty('--hp', '1');
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ['data-a11y-contrast'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    let floating = false;

    const evaluate = () => {
      frame = 0;
      const y = window.scrollY;

      // המעבר הרציף — נכתב ישירות ל-DOM, לא דרך state
      const progress = highContrastRef.current
        ? 1
        : Math.min(1, Math.max(0, (y - PROGRESS_START) / PROGRESS_RANGE));
      headerRef.current?.style.setProperty('--hp', progress.toFixed(3));

      if (!floating && y > ENTER_FLOAT_AT) {
        floating = true;
        setIsFloating(true);
      } else if (floating && y < EXIT_FLOAT_AT) {
        floating = false;
        setIsFloating(false);
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(evaluate);
    };

    // מצב אמיתי מיד אחרי mount — לרענון עמוד שהדפדפן משחזר בו גלילה
    evaluate();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return { isFloating: isFloating || highContrast, headerRef };
}
