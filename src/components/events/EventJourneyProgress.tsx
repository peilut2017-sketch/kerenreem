'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

/**
 * מד ההתקדמות במסע האירוע: קבלת פנים → דברי פתיחה → השיעור → ... —
 * התחנות עצמן מגיעות מ-stage_label של בלוקי הסיפור, לא רשימה קבועה.
 * גם משמש כ"Timeline דינמי" מהאפיון וגם כ"מד התקדמות" — שני רעיונות
 * שהם בעצם אותו דבר: סמן שמתקדם בין תחנות תוך כדי גלילה.
 *
 * בנוי על אותו דפוס בדיוק כמו StickyNav של עמוד הספר: מדידת גובה הכותרת
 * הראשית כדי לא להידבק מתחתיה, scrollspy עם IntersectionObserver ורצועה
 * צרה באמצע המסך, וסמן נע שנמדד לפי offsetLeft פיזי (לא ניחוש רוחב טקסט).
 *
 * אם אף בלוק אינו נושא stage_label, לא מוצג דבר — זה תכונה ולא באג
 * (ראו ההערה על event_blocks.stage_label במיגרציה).
 */
export function EventJourneyProgress({ stages, heroId }: { stages: string[]; heroId: string }) {
  const t = useTranslations('events');
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) =>
      setHeaderHeight(entry.target.getBoundingClientRect().height ?? entry.contentRect.height),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: `-${headerHeight}px 0px 0px 0px`,
    });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroId, headerHeight]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const markers = Array.from(document.querySelectorAll<HTMLElement>('[data-stage-index]'));
    if (markers.length === 0) return;

    // רצועה צרה באמצע המסך: הבלוק שנוגע בה קובע את התחנה הפעילה
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number(entry.target.getAttribute('data-stage-index'));
          if (!Number.isNaN(index)) setActive(index);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    markers.forEach((marker) => observer.observe(marker));
    return () => observer.disconnect();
  }, [stages]);

  const measure = useCallback(() => {
    const marker = markerRef.current;
    const element = itemRefs.current[active];
    if (!marker || !element) return;
    marker.style.transform = `translateX(${element.offsetLeft}px)`;
    marker.style.width = `${element.offsetWidth}px`;
  }, [active]);

  useLayoutEffect(measure, [measure]);

  if (stages.length === 0) return null;

  return (
    // [1.14] הרצועה הזו מוצגת רק אחרי שגללו מעבר לכל ה-Hero — כלומר תמיד
    // כשה-header כבר במצב צף (קפסולה ממורכזת, מוזחת מקצוות המסך —
    // useHeaderState). בלי ההתאמה כאן היא נשארת ברוחב מלא-מסך בעוד
    // הכותרת מעליה כבר מצומצמת, וזה בדיוק מה שגרם לה "לברוח" ברוחב
    // ממנה. אותם קבועים בדיוק (px-3/sm:px-5 בשכבה החיצונית,
    // mx-auto max-w-[82rem] בפנימית) כמו SiteHeaderClient במצב צף.
    <div
      style={{ top: headerHeight }}
      className={`sticky z-30 px-3 transition-all duration-500 sm:px-5 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
      }`}
    >
      <div className="mx-auto max-w-[82rem] rounded-b-[var(--radius-lg)] border-b border-rule bg-cream/90 backdrop-blur">
        <nav aria-label={t('journey')} className="mx-auto max-w-4xl overflow-x-auto px-4 py-2.5 sm:px-6">
          <ul ref={listRef} className="relative flex w-max items-center gap-1">
            <span
              ref={markerRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-1 left-0 rounded-[var(--radius-pill)] bg-cream-2 transition-[transform,width] duration-300 ease-[var(--ease-spring)]"
            />
            {stages.map((stage, index) => (
              <li
                key={stage}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
              >
                <span
                  aria-current={active === index ? 'true' : undefined}
                  className={`relative z-10 flex items-center gap-2 whitespace-nowrap rounded-[var(--radius-pill)] px-3.5 py-1.5 text-caption transition-colors ${
                    active === index ? 'font-semibold text-burgundy' : 'text-ink-soft'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-[var(--radius-pill)] transition-colors ${
                      active >= index ? 'bg-burgundy' : 'bg-rule-strong'
                    }`}
                  />
                  {stage}
                  {index < stages.length - 1 ? (
                    <span aria-hidden="true" className="mx-1 text-rule-strong">
                      ―
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
