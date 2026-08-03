'use client';

import { useEffect } from 'react';

/**
 * חושף את גובה ה-header (הניווט הדביק) כמשתנה CSS גלובלי — --site-header-h.
 *
 * גובהו אינו קבוע (ריווח שונה בין שברי מסך, וגם גופן שגדל מסרגל הנגישות),
 * ולכן נמדד בפועל ולא מונח כמספר. אותה טכניקה בדיוק כמו ב-StickyNav.tsx.
 * המשתנה משמש את גיבורי עמוד הבית (BannerStrip, HeroCarousel) כדי לתחוב
 * את עצמם מתחת ל-header ולצוף מתחתיו, במקום להתחיל אחריו.
 */
export function SiteHeaderHeightVar() {
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header || typeof ResizeObserver === 'undefined') return;

    const apply = (height: number) =>
      document.documentElement.style.setProperty('--site-header-h', `${height}px`);

    apply(header.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) =>
      apply(entry.target.getBoundingClientRect().height ?? entry.contentRect.height),
    );
    observer.observe(header);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--site-header-h');
    };
  }, []);

  return null;
}
