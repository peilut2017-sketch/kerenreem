'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * חזרה לראש העמוד אחרי גלילה משמעותית — בכל עמוד ציבורי (מוצג מ-layout).
 *
 * מופיע רק אחרי שני מסכים של גלילה: כפתור שקיים תמיד תופס מקום קבוע על
 * מסך קטן בלי להצדיק אותו.
 *
 * צד "start" (ימין ב-RTL) ולא "end": ב-FloatingActions של עמוד הספר
 * יש כבר כפתורים צפים בצד end-6, ו-AccessibilityWidget תפוס בפינת ה-
 * start הנמוכה — bottom-28 משאיר לו מרווח נקי מעליו.
 *
 * הגלילה מכבדת prefers-reduced-motion — גלילה חלקה לאורך עמוד ארוך היא
 * בדיוק סוג התנועה שגורם לסחרחורת אצל מי שביקש להפחית תנועה.
 */
export function BackToTop() {
  const t = useTranslations('site');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 2);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduced ? 'instant' : 'smooth' });
      }}
      aria-label={t('backToTop')}
      className="glass fixed bottom-28 start-4 z-30 flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-ink-soft shadow-[var(--shadow-float)] transition-[transform,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:text-burgundy"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
        <path d="M10 16V5m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
