'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Image from 'next/image';

interface NavSection {
  id: string;
  label: string;
}

/**
 * ניווט פנימי דביק לעמוד הספר.
 *
 * מופיע (fade+slide) רק אחרי גלילה מעבר ל-Hero — לא תפוס את המסך מהשנייה
 * הראשונה, כשאין עדיין שום דבר לנווט אליו. נושא איתו כריכה זעירה ושם
 * הספר, כדי שבגלילה עמוקה תמיד ברור באיזה ספר מדובר.
 *
 * הסמן הנע משתמש באותו תבנית בדיוק כמו NavLinks.tsx (הניווט הראשי של
 * האתר): מדידת offsetLeft פיזי, לא הנחת רוחב טקסט, כי עברית, ניגודיות
 * וגודל גופן מהעברת נגישות כולם משנים את הרוחב בפועל.
 */
export function StickyNav({
  sections,
  cover,
  title,
}: {
  sections: NavSection[];
  cover: string | null;
  title: string;
}) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(sections[0]?.id ?? '');
  const [headerHeight, setHeaderHeight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const markerRef = useRef<HTMLSpanElement>(null);

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

  const measure = useCallback(() => {
    const marker = markerRef.current;
    const element = itemRefs.current[active];
    if (!marker || !element) return;
    marker.style.transform = `translateX(${element.offsetLeft}px)`;
    marker.style.width = `${element.offsetWidth}px`;
  }, [active]);

  useLayoutEffect(measure, [measure]);

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div
      ref={rootRef}
      style={{ top: headerHeight }}
      className={`sticky z-30 border-b border-rule bg-cream/90 backdrop-blur transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 pt-1 sm:px-6">
        {cover ? (
          <span className="relative hidden h-10 w-7 shrink-0 overflow-hidden rounded-[var(--radius-xs)] bg-cream-2 sm:block">
            <Image src={cover} alt="" fill sizes="28px" className="object-contain" />
          </span>
        ) : null}
        <span className="hidden shrink-0 truncate font-serif text-small text-ink sm:block sm:max-w-40">
          {title}
        </span>

        <nav aria-label={title} className="min-w-0 flex-1 overflow-x-auto">
          <ul ref={listRef} className="relative flex w-max items-end gap-1">
            <span
              ref={markerRef}
              aria-hidden="true"
              className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-burgundy transition-[transform,width] duration-300 ease-[var(--ease-spring)]"
            />
            {sections.map((section) => (
              <li
                key={section.id}
                ref={(node) => {
                  itemRefs.current[section.id] = node;
                }}
              >
                <button
                  type="button"
                  onClick={() => scrollToSection(section.id)}
                  aria-current={active === section.id ? 'true' : undefined}
                  className={`relative z-10 block whitespace-nowrap px-4 pb-3 pt-2.5 text-small transition-colors ${
                    active === section.id ? 'font-semibold text-burgundy' : 'text-muted hover:text-ink'
                  }`}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
