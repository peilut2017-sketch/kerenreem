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
  filterSummary,
  storeEnabled = false,
}: {
  count: number;
  countLabel: string;
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  view: ViewMode;
  onViewChange: (next: ViewMode) => void;
  filterSlot: React.ReactNode;
  /** שמות הסינונים הפעילים (קטגוריה, חיפוש, מסננים) — לסרגל המצומצם */
  filterSummary: string[];
  /** מיון לפי מחיר מוצג רק כשהחנות (ומחיריה) גלויים */
  storeEnabled?: boolean;
}) {
  const t = useTranslations('books');
  const sortId = useId();
  const fullId = useId();
  const stickyRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  // "תקוע" = הסרגל הגיע לראש המסך ונדבק שם, כלומר המבקר כבר גולל בתוצאות
  const [stuck, setStuck] = useState(false);
  // גובה הגלילה ברגע שהמבקר פתח את הסרגל המלא; null = לא נפתח ידנית
  const [pinnedAt, setPinnedAt] = useState<number | null>(null);
  const compact = stuck && pinnedAt === null;
  const pinned = pinnedAt !== null;

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const element = stickyRef.current;
      if (!element) return;
      const top = Number.parseFloat(getComputedStyle(element).top) || 0;
      setStuck(window.scrollY > 0 && element.getBoundingClientRect().top <= top + 1);
      // סרגל שנפתח ידנית חוזר להצטמצם אחרי שהמבקר ממשיך לגלול הלאה
      setPinnedAt((at) => (at !== null && Math.abs(window.scrollY - at) > 240 ? null : at));
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // אחרי פתיחה ידנית המיקוד עובר לסרגל המלא — הכפתור שנלחץ הוסתר ממש עכשיו
  useEffect(() => {
    if (!pinned) return;
    const frame = requestAnimationFrame(() =>
      fullRef.current?.querySelector<HTMLElement>('button, select')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, [pinned]);

  const hasSummary = filterSummary.length > 0;

  return (
    /* מרווח מהכותרת הצפה לפי גובהה הנמדד (SiteHeaderHeightVar) — ערך קבוע
       נשבר כשסרגל הנגישות מגדיל את הגופן או כשיש שורת ניווט שנייה */
    <div
      ref={stickyRef}
      className="pointer-events-none sticky top-[calc(var(--site-header-h,4.75rem)+0.75rem)] z-20 -mx-2 mb-8 grid px-2"
    >
      {/*
        שני הסרגלים באותו תא של grid: הגובה נקבע תמיד לפי המלא, כך שמעבר
        בין המצבים אינו מזיז את התוצאות שמתחת (קפיצת גלילה). המצומצם הוא
        כפתור אחד — מצב הסינון ומה מסונן — ולחיצה עליו פותחת את המלא.
      */}
      <button
        type="button"
        onClick={() => setPinnedAt(window.scrollY)}
        inert={!compact}
        aria-expanded={!compact}
        aria-controls={fullId}
        aria-label={t('compactExpand')}
        className={`glass pointer-events-auto flex w-full items-center gap-2.5 self-start rounded-[var(--radius-pill)] px-3.5 py-2 text-start text-small text-ink [grid-area:1/1] transition-[opacity,transform] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none ${
          compact ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <span className="relative shrink-0 text-ink-soft">
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
            <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {hasSummary ? (
            <span aria-hidden="true" className="absolute -end-1 -top-1 h-2 w-2 rounded-full bg-burgundy" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className={hasSummary ? 'font-semibold text-burgundy' : 'text-muted'}>
            {hasSummary ? t('compactFiltered') : t('compactNoFilter')}
          </span>
          {hasSummary ? <span className="text-ink-soft">{`: ${filterSummary.join(' · ')}`}</span> : null}
        </span>
        <span className="shrink-0 text-caption tabular-nums text-muted">
          {count} {countLabel}
        </span>
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted" fill="none">
          <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        id={fullId}
        ref={fullRef}
        inert={compact}
        className={`glass flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[var(--radius-lg)] px-4 py-3 [grid-area:1/1] transition-[opacity,transform] duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none ${
          compact ? 'pointer-events-none -translate-y-2 opacity-0' : 'pointer-events-auto translate-y-0 opacity-100'
        }`}
      >
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
