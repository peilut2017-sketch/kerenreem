'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/client-hooks';

/**
 * "Scroll Focus": התמונה שקרובה למרכז המסך מודגשת (scale+צל+בהירות
 * מלאה), האחרות כהות ומטושטשות מעט — כך העין תמיד יודעת במה להתמקד
 * בלי לגלול לאיבוד בין עשרות תמונות.
 *
 * כתיבה ל-CSS custom property ישירות על ה-DOM ולא ל-state של React:
 * זה קורה בכל פריים בזמן גלילה, ורינדור React על כל פריים היה מיותר
 * ויקר. אותו דפוס בדיוק כמו HeroBackground (פרלקס הרקע בעמוד הספר).
 *
 * ברירת המחדל ב-CSS היא --focus: 1 ("הכול במוקד"), ולכן בלי JS או עם
 * prefers-reduced-motion התמונה מוצגת רגיל לגמרי והכיתוב שלה נראה. רק
 * ה-JS *מוריד* מיקוד מתמונות שרחוקות ממרכז המסך — אף פעם לא להפך.
 *
 * מיועד למדיה בלבד. טקסט אינו נכנס לכאן: הורדת בהירות על טקסט היא
 * הורדת ניגודיות, וזה מחיר שאין שום סיבה לשלם עליו אפקט.
 */
export function ScrollFocus({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion) return;

    let ticking = false;

    function update() {
      const rect = node!.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const distance = Math.abs(elementCenter - viewportCenter);
      // ריכוך: 1 במרכז המסך בדיוק, יורד ל-0 במרחק כ-60% מגובה המסך
      const focus = Math.max(0, 1 - distance / (window.innerHeight * 0.6));
      node!.style.setProperty('--focus', String(focus));
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reducedMotion]);

  return (
    <div ref={ref} className={`scroll-focus ${className}`}>
      {children}
    </div>
  );
}
