'use client';

import { useEffect, useState } from 'react';

/** גלילה שמפעילה מצב צף, וגלילה שחוזרת ממנו — לא אותו סף. */
const ENTER_FLOAT_AT = 64;
const EXIT_FLOAT_AT = 24;

/**
 * מצב הניווט: expanded (משולב בראש העמוד) או floating (קפסולה צפה).
 *
 * Hysteresis בכוונה: סף אחד לכניסה למצב צף ואחר, נמוך ממנו, לחזרה
 * ממנו. בלי זה, גלילה שנעצרת בול על סף בודד גורמת למצב להבהב קדימה
 * ואחורה בכל פיקסל נוסף.
 *
 * ניגודיות גבוהה: זכוכית מעל תמונת רקע כלשהי (הבאנר בעמוד הבית, למשל)
 * אינה מבטיחה ניגודיות תקינה, ולכן במצב הזה הניווט נשאר תמיד "צף"
 * (אטום, עם מסגרת) בלי תלות בגלילה בפועל.
 */
export function useHeaderState() {
  const [isFloating, setIsFloating] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setHighContrast(html.getAttribute('data-a11y-contrast') === 'on');
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

  return { isFloating: isFloating || highContrast };
}
