'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { computeWindow } from '@/lib/windowed-range';
import type { ContextNavValue } from './header-context-nav';

/** [1.30] רדיוס קטן מה-Filmstrip: הכותרת חולקת מקום עם הלוגו, הניווט הראשי ופעולות הצד. */
const RADIUS = 2;

/**
 * [1.30] ניווט הקשרי בתוך קפסולת הכותרת הצפה — שלבי אירוע/מקטעי ספר
 * שהעמוד הנוכחי פרסם (usePublishHeaderContextNav). מופרד מהניווט
 * הראשי בקו דק ובצבע פעיל שונה (בורדו, כמו EventJourneyProgress/
 * StickyNav הישנים) כדי שברור מה שייך לעמוד ומה לניווט הראשי של
 * האתר. חלון קטן סביב הפריט הפעיל — לא כל השלבים בבת אחת — כשיש
 * הרבה, כדי שלא יציף את שאר תוכן הכותרת.
 */
export function HeaderContextNav({ items, activeId, onSelect }: ContextNavValue) {
  const t = useTranslations('nav');
  const activeIndex = Math.max(
    0,
    items.findIndex((item) => item.id === activeId),
  );
  const windowIndexes = useMemo(
    () => computeWindow(activeIndex, items.length, RADIUS),
    [activeIndex, items.length],
  );

  return (
    <div
      role="list"
      aria-label={t('pageNavigation')}
      className="hidden items-center gap-0.5 border-s border-rule ps-3 lg:flex"
    >
      {windowIndexes.map((index) => {
        const item = items[index];
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-current={active ? 'true' : undefined}
            title={item.label}
            className={`max-w-32 truncate whitespace-nowrap rounded-[var(--radius-pill)] px-2.5 py-1 text-caption transition-colors duration-200 ${
              active
                ? 'bg-burgundy/10 font-semibold text-burgundy'
                : 'text-ink-soft hover:bg-cream-2 hover:text-burgundy'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
