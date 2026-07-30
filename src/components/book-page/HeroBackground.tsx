'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/client-hooks';

/**
 * רקע ה-Hero: שלושת צבעי הכריכה, לא Gradient קבוע אחד לכל הספרים.
 *
 * שכבות: כתם עדין לכל צבע (blur ענק), רעש עדין מעל (SVG feTurbulence,
 * כדי שמשטח הצבע הגדול לא ייראה שטוח ודיגיטלי), והכול נע קלות בגלילה
 * (parallax) — הרקע לאט מהתוכן, לא צמוד אליו.
 *
 * הפרלקס מבוטל לגמרי כש-prefers-reduced-motion פעיל, לא רק מואט.
 */
export function HeroBackground({ colors }: { colors: [string, string, string] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        // התזוזה מוגבלת ל-40 פיקסלים: פרלקס עדין, לא אפקט שמושך את העין
        const offset = Math.min(window.scrollY * 0.15, 40);
        node!.style.transform = `translateY(${offset}px)`;
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  const [primary, secondary, tertiary] = colors;

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        ref={ref}
        className="absolute inset-[-10%]"
        style={{
          backgroundImage: [
            `radial-gradient(60% 55% at 20% 20%, ${primary}55, transparent 70%)`,
            `radial-gradient(55% 60% at 85% 15%, ${secondary}4d, transparent 70%)`,
            `radial-gradient(70% 65% at 50% 100%, ${tertiary}40, transparent 70%)`,
          ].join(', '),
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-cream" />
    </div>
  );
}
