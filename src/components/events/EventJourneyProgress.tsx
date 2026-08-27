'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePublishHeaderContextNav } from '@/components/header-context-nav';

/**
 * [1.30] מד ההתקדמות במסע האירוע: קבלת פנים → דברי פתיחה → השיעור →
 * ... — התחנות עצמן מגיעות מ-stage_label של בלוקי הסיפור, לא רשימה
 * קבועה. לא מרנדר רצועה משלו יותר: מפרסם את התחנות והפעילה שבהן
 * לכותרת הראשית (usePublishHeaderContextNav) — שם הן מתווספות
 * לקפסולה הצפה עצמה בגלילה, לא כפס נפרד מתחתיה. ראו header-context-nav.tsx.
 *
 * אם אף בלוק אינו נושא stage_label, לא מתפרסם דבר — זו תכונה ולא באג
 * (ראו ההערה על event_blocks.stage_label במיגרציה).
 */
export function EventJourneyProgress({ stages }: { stages: string[] }) {
  const [active, setActive] = useState(0);

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

  const items = useMemo(
    () => stages.map((label, index) => ({ id: String(index), label })),
    [stages],
  );

  const scrollToStage = useCallback((id: string) => {
    const target = document.querySelector<HTMLElement>(`[data-stage-index="${id}"]`);
    if (!target) return;
    const header = document.querySelector('header');
    const offset = (header?.getBoundingClientRect().height ?? 0) + 16;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }, []);

  usePublishHeaderContextNav(items, String(active), scrollToStage);

  return null;
}
