'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserRole } from '@/lib/supabase/types';

const ITEMS: { href: string; label: string; minRole: UserRole }[] = [
  { href: '/admin', label: 'דשבורד', minRole: 'viewer' },
  { href: '/admin/banners', label: 'באנרים', minRole: 'viewer' },
  { href: '/admin/books', label: 'ספרים', minRole: 'viewer' },
  { href: '/admin/authors', label: 'מחברים', minRole: 'viewer' },
  { href: '/admin/categories', label: 'קטגוריות', minRole: 'viewer' },
  { href: '/admin/series', label: 'סדרות', minRole: 'viewer' },
  { href: '/admin/tags', label: 'תגיות', minRole: 'viewer' },
  { href: '/admin/events', label: 'אירועים', minRole: 'viewer' },
  { href: '/admin/activities', label: 'צירי פעילות', minRole: 'viewer' },
  { href: '/admin/pages', label: 'עמודי תוכן', minRole: 'viewer' },
  { href: '/admin/messages', label: 'פניות מהאתר', minRole: 'editor' },
  { href: '/admin/settings', label: 'הגדרות', minRole: 'admin' },
  { href: '/admin/diagnostics', label: 'אבחון', minRole: 'admin' },
];

const RANK: Record<UserRole, number> = { viewer: 0, editor: 1, admin: 2 };

/**
 * ניווט הניהול — שורה עליונה עם סמן נע, כמו באתר הציבורי.
 *
 * היה סרגל צד. בפועל הוא גזל רוחב קבוע מהטבלאות דווקא במסכים שבהם הרוחב
 * הכי נחוץ, ובמסך צר הוא התקפל לשורה ממילא — כלומר שתי פריסות לתחזק.
 *
 * הסמן נמדד מה-DOM ונכתב אליו ישירות, בלי state: מדידה ואז setState היא
 * רינדור נוסף בכל תזוזת עכבר. offsetLeft נמדד מקצה שמאל בשני כיווני
 * הכתיבה, ולכן העיגון חייב להיות left פיזי ולא start הלוגי — אחרת ב-RTL
 * כל פריט סוטה ביחס לרוחבו.
 */
export function AdminNav({ role }: { role: UserRole }) {
  const pathname = usePathname();
  // ממוזכר כדי שהשרשרת visible → activeIndex → target → measure תישאר
  // יציבה; בלעדיו כל רינדור יוצר מערך חדש ו-measure נבנה מחדש בכל פעם.
  const visible = useMemo(() => ITEMS.filter((item) => RANK[role] >= RANK[item.minRole]), [role]);

  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const activeIndex = visible.findIndex((item) =>
    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href),
  );

  const target = hovered ?? (activeIndex >= 0 ? activeIndex : null);

  const measure = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const element = target === null ? null : itemRefs.current[target];
    if (!element) {
      marker.style.opacity = '0';
      return;
    }

    marker.style.transform = `translateX(${element.offsetLeft}px)`;
    marker.style.width = `${element.offsetWidth}px`;
    marker.style.opacity = '1';
  }, [target]);

  useEffect(measure, [measure]);

  // הרשימה נגללת אופקית במסך צר, וגלילה מזיזה את הפריטים תחת הסמן
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    list.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(list);

    return () => {
      list.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [measure]);

  return (
    <nav aria-label="ניווט ניהול">
      <ul
        ref={listRef}
        onMouseLeave={() => setHovered(null)}
        className="relative flex items-center gap-1 overflow-x-auto pb-1"
      >
        {/* הסמן מוסתר מהנגישות: המצב מוסר דרך aria-current על הקישור */}
        <span
          ref={markerRef}
          aria-hidden="true"
          style={{ opacity: 0 }}
          className="pointer-events-none absolute inset-y-0 left-0 rounded-[var(--radius-pill)] bg-cream-2 transition-[transform,width,opacity] duration-400 ease-[var(--ease-spring)] motion-reduce:transition-none"
        />

        {visible.map((item, index) => (
          <li
            key={item.href}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            onMouseEnter={() => setHovered(index)}
            className="shrink-0"
          >
            <Link
              href={item.href}
              aria-current={index === activeIndex ? 'page' : undefined}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className={`relative z-10 block whitespace-nowrap rounded-[var(--radius-pill)] px-3.5 py-1.5 text-small transition-colors duration-300 ${
                index === activeIndex
                  ? 'font-semibold text-burgundy'
                  : 'text-ink-soft hover:text-burgundy'
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
