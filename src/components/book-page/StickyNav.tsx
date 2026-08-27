'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePublishHeaderContextNav } from '@/components/header-context-nav';

interface NavSection {
  id: string;
  label: string;
}

/**
 * [1.32] אין כאן יותר רצועה דביקה משלה — כריכה, כותרת ומחיר/רכישה
 * התמזגו לתוך קפסולת הכותרת הראשית עצמה, בגרסה מצומצמת (ראו
 * ContextNavIdentity ב-header-context-nav.tsx וה-actions cluster
 * ב-SiteHeaderClient): בלי כריכה ובלי כותרת מלאה, רק מחיר וכפתור
 * מעבר לרכישה. אותו דפוס פרסום בדיוק כמו EventJourneyProgress —
 * הרכיב הזה הוא כעת רק scroll-spy שמפרסם, לא מרנדר בעצמו.
 */
export function StickyNav({
  sections,
  title,
  price,
}: {
  sections: NavSection[];
  title: string;
  /** מחיר מעוצב מראש — כפתור הרכישה בכותרת מוצג רק כשהוא קיים */
  price?: string | null;
}) {
  const [active, setActive] = useState(sections[0]?.id ?? '');

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

  const onBuy = useCallback(() => {
    document.getElementById('book-purchase')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  usePublishHeaderContextNav(sections, active, scrollToSection, { title, price, onBuy });

  return null;
}
