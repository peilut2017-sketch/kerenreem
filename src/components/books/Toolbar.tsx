'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useReducedMotion } from '@/lib/client-hooks';
import type { SortKey } from '@/lib/book-search';

export type ViewMode = 'grid' | 'large' | 'list';

/**
 * מונה שמתגלגל אל הערך החדש.
 *
 * ההנפשה משרתת מטרה ולא רק נעימות: כשמסננים, השינוי במספר הוא המשוב
 * העיקרי על כך שהפעולה נקלטה. קפיצה מיידית בין שני מספרים קל לפספס.
 *
 * prefers-reduced-motion מקבל את הערך מיד וללא גלגול, ואת ההכרזה לקורא
 * מסך עושה אזור נפרד — מספר שמתחלף עשר פעמים בשנייה באזור חי הוא רעש.
 */
function RollingCount({ value, label }: { value: number; label: string }) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (reduced) return;

    const start = performance.now();
    const from = display;
    const distance = value - from;
    if (distance === 0) return;

    const step = (now: number) => {
      const progress = Math.min((now - start) / 420, 1);
      // האטה בסוף, כך שהמספר "נוחת" ולא נעצר בחדות
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + distance * eased));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    };
    // display מכוון להיעדר: הוא נקודת הפתיחה של הגלגול, לא טריגר שלו
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return (
    <p className="text-small text-ink-soft">
      <span aria-hidden="true" className="font-semibold tabular-nums">
        {reduced ? value : display}
      </span>{' '}
      <span aria-hidden="true">{label}</span>
      <span className="sr-only" aria-live="polite">
        {value} {label}
      </span>
    </p>
  );
}

export function Toolbar({
  count,
  countLabel,
  sort,
  onSortChange,
  view,
  onViewChange,
  filterSlot,
  storeEnabled = false,
}: {
  count: number;
  countLabel: string;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  view: ViewMode;
  onViewChange: (next: ViewMode) => void;
  filterSlot: React.ReactNode;
  /** מיון לפי מחיר מוצג רק כשהחנות (ומחיריה) גלויים */
  storeEnabled?: boolean;
}) {
  const t = useTranslations('books');
  const sortId = useId();

  return (
    /* מרווח מהכותרת הצפה לפי גובהה הנמדד (SiteHeaderHeightVar) — ערך קבוע
       נשבר כשסרגל הנגישות מגדיל את הגופן או כשיש שורת ניווט שנייה */
    <div className="sticky top-[calc(var(--site-header-h,4.75rem)+0.75rem)] z-20 -mx-2 mb-8 px-2">
      <div className="glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius-lg)] px-4 py-3">
        <RollingCount value={count} label={countLabel} />

        <div className="ms-auto flex flex-wrap items-center gap-3">
          {filterSlot}

          {/* label נפרד עם htmlFor ולא עוטף: label שעוטף select סופג את
              טקסט האפשרויות לתוך השם הנגיש, והתוצאה היא "מיון מומלצים חדש
              ביותר ותיק ביותר א׳-ת׳" כשם השדה. */}
          <div className="flex items-center gap-2 text-small text-muted">
            <label htmlFor={sortId} className="whitespace-nowrap">
              {t('sort')}
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
              className="rounded-[var(--radius-pill)] border border-rule bg-white/70 px-3 py-1.5 text-small text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <option value="recommended">{t('sortRecommended')}</option>
              <option value="newest">{t('sortNewest')}</option>
              <option value="oldest">{t('sortOldest')}</option>
              <option value="title">{t('sortTitle')}</option>
              {storeEnabled ? (
                <>
                  <option value="priceAsc">{t('sortPriceAsc')}</option>
                  <option value="priceDesc">{t('sortPriceDesc')}</option>
                </>
              ) : null}
            </select>
          </div>

          <div role="group" aria-label={t('view')} className="flex items-center gap-1">
            <ViewButton current={view} mode="grid" onSelect={onViewChange} label={t('viewGrid')} />
            <ViewButton current={view} mode="large" onSelect={onViewChange} label={t('viewLarge')} />
            <ViewButton current={view} mode="list" onSelect={onViewChange} label={t('viewList')} />
          </div>
        </div>
      </div>
    </div>
  );
}

const VIEW_ICON: Record<ViewMode, string> = {
  grid: 'M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z',
  large: 'M3 3h14v6H3zM3 11h14v6H3z',
  list: 'M3 5h14M3 10h14M3 15h14',
};

function ViewButton({
  current,
  mode,
  onSelect,
  label,
}: {
  current: ViewMode;
  mode: ViewMode;
  onSelect: (mode: ViewMode) => void;
  label: string;
}) {
  const selected = current === mode;

  return (
    <button
      type="button"
      onClick={() => onSelect(mode)}
      aria-pressed={selected}
      aria-label={label}
      className={`rounded-[var(--radius-pill)] p-2 transition-colors ${
        selected ? 'bg-white/80 text-burgundy' : 'text-muted hover:text-ink'
      }`}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
        <path
          d={VIEW_ICON[mode]}
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
