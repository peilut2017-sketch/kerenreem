'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import { toCdnUrl } from '@/lib/image-src';
import type { EventMediaItem } from '@/lib/supabase/types';

type Media = EventMediaItem;

const RADIUS_DEFAULT = 3;
const RADIUS_WIDE = 4;
const WIDE_BREAKPOINT = 1600;

const THUMB_HEIGHT = 56; // px — גובה קבוע; הרוחב נגזר מיחס הממדים
const THUMB_MIN_WIDTH = 40;
const THUMB_MAX_WIDTH = 92;

const WHEEL_STEP_THRESHOLD = 42;
const WHEEL_COOLDOWN_MS = 260;

/** חלון תמונונות סביב האינדקס הפעיל — ללא "מקומות ריקים" בקצוות הגלריה. */
function computeWindow(current: number, total: number, radius: number): number[] {
  if (total <= radius * 2 + 1) return Array.from({ length: total }, (_, i) => i);
  let start = current - radius;
  let end = current + radius;
  if (start < 0) {
    end += -start;
    start = 0;
  } else if (end > total - 1) {
    start -= end - (total - 1);
    end = total - 1;
  }
  start = Math.max(0, start);
  end = Math.min(total - 1, end);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function useFilmstripRadius(): number {
  const [radius, setRadius] = useState(RADIUS_DEFAULT);
  useEffect(() => {
    const update = () => setRadius(window.innerWidth >= WIDE_BREAKPOINT ? RADIUS_WIDE : RADIUS_DEFAULT);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return radius;
}

function thumbAspect(item: Media): number {
  if (item.width && item.height && item.height > 0) return item.width / item.height;
  return 4 / 3;
}

/**
 * [1.20] Contextual Filmstrip Navigator — פס תמונונות צף בתחתית ה-Viewer
 * מלא-המסך, מציג חלון תמונונות סביב הפריט הפעיל (לא את כל הגלריה) ומאפשר
 * קפיצה ישירה בלחיצה. משטח "זכוכית כהה" של האתר עצמו (.glass-dark) —
 * לא Dock של macOS ולא Lightbox גנרי.
 */
export function ContextualFilmstrip({
  media,
  activeIndex,
  onSelect,
  onHoverPause,
  onHoverResume,
  reducedMotion,
}: {
  media: Media[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onHoverPause: () => void;
  onHoverResume: () => void;
  reducedMotion: boolean;
}) {
  const t = useTranslations('events');
  const radius = useFilmstripRadius();
  const windowIndexes = useMemo(
    () => computeWindow(activeIndex, media.length, radius),
    [activeIndex, media.length, radius],
  );

  const wheelAccum = useRef(0);
  const wheelCooldown = useRef(false);

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    // [1.20] גלגלת מעל הפילם-סטריפ מנווטת בין תמונות (לא גוללת עמוד) —
    // אבל אסור "לחטוף" גלגלת מעל התמונה הראשית, לכן זה ממוקד רק כאן.
    event.preventDefault();
    event.stopPropagation();
    if (wheelCooldown.current) return;
    wheelAccum.current += event.deltaY + event.deltaX;
    if (Math.abs(wheelAccum.current) < WHEEL_STEP_THRESHOLD) return;
    const direction = wheelAccum.current > 0 ? 1 : -1;
    wheelAccum.current = 0;
    const next = activeIndex + direction;
    if (next >= 0 && next < media.length) {
      onSelect(next);
      wheelCooldown.current = true;
      setTimeout(() => {
        wheelCooldown.current = false;
      }, WHEEL_COOLDOWN_MS);
    }
  }

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
      transition={{ duration: reducedMotion ? 0.15 : 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="glass-dark pointer-events-auto absolute inset-x-0 bottom-6 z-20 mx-auto flex max-w-fit flex-col gap-2 rounded-[var(--radius-lg)] px-3 py-2.5 sm:bottom-8"
      onMouseEnter={onHoverPause}
      onMouseLeave={onHoverResume}
      onFocus={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHoverPause();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHoverResume();
      }}
      onWheel={handleWheel}
    >
      <div role="list" aria-label={t('gallery')} className="flex items-end gap-1.5">
        {windowIndexes.map((index) => {
          const item = media[index];
          const prevItem = index > 0 ? media[index - 1] : null;
          const chapterBoundary =
            windowIndexes[0] !== index && prevItem && prevItem.chapter_id !== item.chapter_id;
          return (
            <FilmstripItem
              key={item.id}
              item={item}
              index={index}
              total={media.length}
              active={index === activeIndex}
              distance={Math.abs(index - activeIndex)}
              chapterBoundary={Boolean(chapterBoundary)}
              onSelect={() => onSelect(index)}
              reducedMotion={reducedMotion}
              label={t('goToImage', { index: index + 1 })}
              tooltip={item.caption_he ?? t('imageCounter', { index: index + 1, total: media.length })}
            />
          );
        })}
      </div>
      <GalleryProgress media={media} activeIndex={activeIndex} />
    </motion.div>
  );
}

function FilmstripItem({
  item,
  index,
  total,
  active,
  distance,
  chapterBoundary,
  onSelect,
  reducedMotion,
  label,
  tooltip,
}: {
  item: Media;
  index: number;
  total: number;
  active: boolean;
  distance: number;
  chapterBoundary: boolean;
  onSelect: () => void;
  reducedMotion: boolean;
  label: string;
  tooltip: string;
}) {
  const aspect = thumbAspect(item);
  const width = Math.min(THUMB_MAX_WIDTH, Math.max(THUMB_MIN_WIDTH, Math.round(THUMB_HEIGHT * aspect)));
  // עמעום לפי מרחק מהפעיל: קרוב 0.9, רחוק 0.55–0.7 — לא בינארי
  const opacity = active ? 1 : distance === 1 ? 0.9 : distance <= 3 ? 0.7 : 0.55;

  return (
    <span className="flex items-end gap-1.5">
      {chapterBoundary ? (
        <span aria-hidden="true" className="mb-1 h-10 w-px shrink-0 self-end bg-white/20" />
      ) : null}
      <motion.button
        type="button"
        layout={!reducedMotion}
        transition={
          reducedMotion
            ? { duration: 0.12 }
            : { type: 'spring', bounce: 0, duration: 0.22 }
        }
        onClick={onSelect}
        title={tooltip}
        aria-label={label}
        aria-current={active ? 'true' : undefined}
        style={{ height: THUMB_HEIGHT, width }}
        animate={{ opacity, scale: active ? 1.08 : 1 }}
        whileHover={reducedMotion ? undefined : { scale: active ? 1.08 : 1.04 }}
        className={`group relative shrink-0 overflow-hidden rounded-[var(--radius-sm)] transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70 ${
          active
            ? 'border border-gold/70 shadow-[0_4px_14px_-4px_rgba(0,0,0,0.55)]'
            : 'border border-white/10'
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- תמונון קטן ומספר גדול; לא ראוי ל-next/image */}
        <img
          src={toCdnUrl(item.thumbnail_url ?? item.url)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: `${Number(item.focal_x) * 100}% ${Number(item.focal_y) * 100}%` }}
        />
        {item.type === 'video' ? (
          <span className="absolute inset-0 flex items-center justify-center bg-navy/25">
            <svg viewBox="0 0 20 20" className="h-4 w-4 text-cream drop-shadow" fill="currentColor" aria-hidden="true">
              <path d="M7 5v10l9-5z" />
            </svg>
          </span>
        ) : null}
        <span className="sr-only">{`${index + 1}/${total}`}</span>
      </motion.button>
    </span>
  );
}

/** קו התקדמות דק לכל הגלריה, מקוטע לפי שלב כשיש שלבים. */
function GalleryProgress({ media, activeIndex }: { media: Media[]; activeIndex: number }) {
  const segments = useMemo(() => {
    const list: { chapterId: string | null; count: number }[] = [];
    for (const item of media) {
      const last = list[list.length - 1];
      if (last && last.chapterId === item.chapter_id) last.count += 1;
      else list.push({ chapterId: item.chapter_id, count: 1 });
    }
    return list;
  }, [media]);

  if (segments.length <= 1) {
    return (
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gold transition-[width] duration-300 ease-out"
          style={{ width: `${((activeIndex + 1) / media.length) * 100}%` }}
        />
      </div>
    );
  }

  let cursor = 0;
  return (
    <div className="flex h-[3px] w-full gap-0.5" aria-hidden="true">
      {segments.map((segment, segmentIndex) => {
        const start = cursor;
        const end = cursor + segment.count;
        cursor = end;
        // לפני השלב הפעיל — מלא; אחריו — ריק; בתוכו — יחסי למיקום
        const width =
          activeIndex >= end ? 100 : activeIndex < start ? 0 : ((activeIndex - start + 1) / segment.count) * 100;
        return (
          <div
            key={`${segment.chapterId ?? 'none'}-${segmentIndex}`}
            className="h-full flex-1 overflow-hidden rounded-full bg-white/15"
            style={{ flexGrow: segment.count }}
          >
            <div
              className="h-full bg-gold transition-[width] duration-300 ease-out"
              style={{ width: `${width}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
