'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';

/**
 * הופעה עדינה בגלילה.
 *
 * שתי החלטות שמונעות מזה להיות "אפקט":
 * 1. ברירת המחדל ב-CSS היא גלוי. ההסתרה מופעלת רק אחרי ש-JS הוסיף
 *    את המחלקה js ל-<html>. סקריפט שנכשל משאיר עמוד קריא, לא עמוד ריק.
 * 2. prefers-reduced-motion מבטל את ההסתרה לחלוטין ב-CSS.
 *
 * ההופעה קורית פעם אחת. אלמנט שמהבהב בכל גלילה הוא הסחה, לא עידון.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  className = '',
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  /** השהיה קטנה ליצירת מדרג בין פריטים סמוכים (במילישניות) */
  delay?: number;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      node.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
