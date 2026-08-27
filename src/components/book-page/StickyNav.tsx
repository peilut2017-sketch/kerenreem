'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Img as Image } from '@/components/Img';
import { useTranslations } from 'next-intl';
import { usePublishHeaderContextNav } from '@/components/header-context-nav';

interface NavSection {
  id: string;
  label: string;
}

/**
 * [1.30] רצועה דביקה לעמוד הספר: כריכה זעירה, שם הספר וכפתור מעבר
 * לרכישה — כדי שבגלילה עמוקה תמיד ברור באיזה ספר מדובר ואיך קונים
 * אותו. ניווט הפרקים/המקטעים עצמו כבר לא כאן: הוא מתפרסם לכותרת
 * הראשית (usePublishHeaderContextNav, כמו ב-EventJourneyProgress)
 * ומתווסף לקפסולה הצפה שלה — לא עוד רצועת ניווט שנייה מתחת לראשונה.
 *
 * הסמן הנע הישן והרצועה עצמה נשארו (זו לא רצועת ניווט, פס זהות/רכישה),
 * וכך גם מדידת --book-nav-offset — היא עדיין רצועה דביקה שנייה בפועל.
 */
export function StickyNav({
  sections,
  cover,
  title,
  price,
}: {
  sections: NavSection[];
  cover: string | null;
  title: string;
  /** מחיר מעוצב מראש — הכפתור מוצג רק כשהוא קיים, כמו ב-BookHeroActions */
  price?: string | null;
}) {
  const t = useTranslations('books');
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [headerHeight, setHeaderHeight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // הניווט הראשי של האתר (SiteHeader) הוא sticky top-0 z-40 בפני עצמו —
  // בלי המדידה כאן שני הסרגלים היו נדבקים לאותו top:0 ומכסים זה את זה.
  // גובהו אינו קבוע (ריווח שונה בין שברי מסך, וגם גופן שגדל מסרגל
  // הנגישות), ולכן נמדד בפועל ולא מונח כמספר.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => setHeaderHeight(entry.target.getBoundingClientRect().height ?? entry.contentRect.height));
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // גובה שני הסרגלים יחד, למשתני scroll-margin-top של יעדי הקפיצה בעמוד
  // (ראו --book-nav-offset ב-SectionHeading ו-AuthorSection) — כדי
  // שקפיצה לעוגן לא תציג כותרת חצי-מכוסה מאחורי הסרגלים הדביקים.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;

    const apply = () => {
      const total = headerHeight + root.getBoundingClientRect().height + 16;
      document.documentElement.style.setProperty('--book-nav-offset', `${total}px`);
    };
    apply();

    const observer = new ResizeObserver(apply);
    observer.observe(root);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--book-nav-offset');
    };
  }, [headerHeight]);

  useEffect(() => {
    const hero = document.getElementById('book-hero');
    if (!hero || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: `-${headerHeight}px 0px 0px 0px`,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [headerHeight]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = sections
      .map((section) => document.getElementById(section.id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    // רצועה צרה באמצע המסך: הסקשן שנוגע בה נחשב "פעיל", תבנית scroll-spy מוכרת
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  usePublishHeaderContextNav(sections, active, scrollToSection);

  return (
    <div
      ref={rootRef}
      style={{ top: headerHeight }}
      className={`sticky z-30 border-b border-rule bg-cream/90 backdrop-blur transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
        {cover ? (
          <span className="relative h-9 w-6 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-cream-2 sm:h-10 sm:w-7">
            <Image src={cover} alt="" fill sizes="28px" className="object-contain" />
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate font-serif text-small text-ink">{title}</span>

        {price ? (
          <button
            type="button"
            onClick={() => document.getElementById('book-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-pill)] bg-navy px-4 py-2 text-caption text-cream transition-colors hover:bg-navy-2"
          >
            {/* [1.4] הכפתור רק גולל לגוש הרכישה — לא מוסיף כלום; הכיתוב
                אמר בעבר "הוספה לסל" למרות זאת (ראו FloatingActions לתיקון
                המקביל בכפתור שכן מוסיף בפועל). */}
            {t('goToPurchase')} · {price}
          </button>
        ) : null}
      </div>
    </div>
  );
}
