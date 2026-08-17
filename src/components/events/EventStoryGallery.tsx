'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Img } from '@/components/Img';
import { recordEventMediaView } from '@/lib/events/view-actions';
import { toCdnUrl } from '@/lib/image-src';
import { localizedOrNull } from '@/lib/localized';
import type { EventChapter, EventMediaItem } from '@/lib/supabase/types';

/**
 * [1.11] Event Story Gallery — תצוגת המדיה של אירוע כסיפור, לא כרשת
 * אחידה של תמונות ממוזערות:
 *
 * Desktop/Tablet — פריסה עריכתית: שלבי האירוע ככותרות ביניים, והתמונות
 * בקומפוזיציות מתחלפות שנבחרות לפי יחס התמונה (רחבה קולנועית לבדה,
 * זוג פורטרטים, ראשית+משניות). לחיצה פותחת Viewer מלא-מסך כהה עם
 * ניווט מקלדת/החלקה, כתובית, שלב, מונה ושיתוף — ועם deep-link
 * ‏(?media=id) שמשתלב בהיסטוריית הדפדפן: Back סוגר את ה-Viewer.
 *
 * Mobile — חוויית דפדוף (Reels): כרטיס כניסה בולט, ומסך מלא עם
 * scroll-snap אנכי — כל פריט תופס 100dvh, רקע מטושטש מאותה תמונה,
 * מונה התקדמות ושם השלב למעלה, כתובית למטה. אין לייקים ואין תגובות —
 * דפוס האינטראקציה של Reels, לא חיקוי רשת חברתית.
 */

type Media = EventMediaItem;

/**
 * [1.14] מונה צפיות פר-פריט — נספר פעם אחת לכל ביקור (Set בזיכרון
 * הרכיב, לא ב-storage) בכל תצוגה שבה הפריט אכן נצפה בפועל: אריח
 * בפריסה העריכתית שנכנס לתצוגה, פריט Reels שהופך פעיל, או אינדקס
 * ה-Viewer הנוכחי. fire-and-forget — אינו חוסם ואינו מציג שגיאה.
 */
function useMediaViewTracker() {
  const seen = useRef<Set<string>>(new Set());
  return useCallback((id: string) => {
    if (seen.current.has(id)) return;
    seen.current.add(id);
    void recordEventMediaView(id);
  }, []);
}

/** עוקב אחרי כניסת האלמנט לתצוגה, פעם אחת בלבד, ואז מפסיק להאזין. */
function useInViewOnce<T extends HTMLElement>(onView: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onView();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onView יציב (useCallback ב-useMediaViewTracker)
  }, []);
  return ref;
}

const ratio = (item: Media) =>
  item.width && item.height && item.height > 0 ? item.width / item.height : 4 / 3;

const focal = (item: Media) => `${Number(item.focal_x) * 100}% ${Number(item.focal_y) * 100}%`;

/** מנוע הפריסה העריכתית: מקבץ רצף פריטים לשורות קומפוזיציה. */
function composeRows(items: Media[]): Media[][] {
  const rows: Media[][] = [];
  let index = 0;
  let alternate = 0;
  while (index < items.length) {
    const current = items[index];
    const ar = ratio(current);
    if (current.type === 'video' || ar >= 1.9 || current.is_featured) {
      rows.push([current]);
      index += 1;
      continue;
    }
    const next = items[index + 1];
    if (ar < 0.85 && next && next.type === 'image' && ratio(next) < 0.85) {
      rows.push([current, next]); // זוג פורטרטים
      index += 2;
      continue;
    }
    const third = items[index + 2];
    if (
      alternate % 2 === 1 &&
      next &&
      third &&
      next.type === 'image' &&
      third.type === 'image' &&
      ratio(next) >= 0.85 &&
      ratio(third) >= 0.85
    ) {
      rows.push([current, next, third]); // ראשית + שתי משניות
      index += 3;
    } else if (next && next.type === 'image') {
      rows.push([current, next]); // Duo
      index += 2;
    } else {
      rows.push([current]);
      index += 1;
    }
    alternate += 1;
  }
  return rows;
}

export function EventStoryGallery({
  media,
  chapters,
  locale,
}: {
  media: Media[];
  chapters: EventChapter[];
  locale: string;
}) {
  const t = useTranslations('events');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [reelsOpen, setReelsOpen] = useState(false);
  const [reelsStart, setReelsStart] = useState(0);
  const trackView = useMediaViewTracker();

  const chapterName = useMemo(() => {
    const map = new Map<string, string>();
    for (const chapter of chapters) {
      map.set(chapter.id, localizedOrNull(chapter, 'title', locale) ?? chapter.title_he);
    }
    return map;
  }, [chapters, locale]);

  /** קבוצות לפי שלב, בסדר השלבים; פריטים בלי שלב — קבוצה פותחת. */
  const groups = useMemo(() => {
    const known = new Set(chapters.map((chapter) => chapter.id));
    const list: { id: string | null; title: string | null; items: Media[] }[] = [];
    const unassigned = media.filter((item) => !item.chapter_id || !known.has(item.chapter_id));
    if (unassigned.length > 0) list.push({ id: null, title: null, items: unassigned });
    for (const chapter of chapters) {
      const items = media.filter((item) => item.chapter_id === chapter.id);
      if (items.length > 0) {
        list.push({ id: chapter.id, title: chapterName.get(chapter.id) ?? chapter.title_he, items });
      }
    }
    return list;
  }, [media, chapters, chapterName]);

  const openViewer = useCallback(
    (item: Media) => {
      const index = media.findIndex((candidate) => candidate.id === item.id);
      if (index !== -1) setViewerIndex(index);
    },
    [media],
  );

  // Deep-link: פתיחת ה-Viewer נרשמת בהיסטוריה — Back סוגר אותו, לא את העמוד
  useEffect(() => {
    if (viewerIndex == null) return;
    const url = new URL(window.location.href);
    url.searchParams.set('media', media[viewerIndex].id);
    window.history.pushState({ krViewer: true }, '', url);
    const onPop = () => setViewerIndex(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- נרשם רק בפתיחה
  }, [viewerIndex == null]);

  // כניסה עם ?media=… — פתיחה ישירה של הפריט המבוקש. פריים נדחה כדי
  // שהפתיחה לא תתמזג עם ההידרציה (השרת רינדר בלי Viewer).
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('media');
    if (!requested) return;
    const index = media.findIndex((item) => item.id === requested);
    if (index === -1) return;
    const frame = requestAnimationFrame(() => setViewerIndex(index));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- פעם אחת בטעינה
  }, []);

  const closeViewer = useCallback(() => {
    if (window.history.state?.krViewer) window.history.back();
    else setViewerIndex(null);
  }, []);

  if (media.length === 0) return null;

  const previews = media.filter((item) => item.type === 'image').slice(0, 3);

  return (
    <section aria-label={t('gallery')}>
      {/* ---- מובייל: כרטיס כניסה לחוויית הדפדוף ---- */}
      <div className="sm:hidden">
        <button
          type="button"
          onClick={() => {
            setReelsStart(0);
            setReelsOpen(true);
          }}
          className="card card-interactive block w-full p-5 text-start"
        >
          <span className="flex items-center gap-4">
            <span className="relative h-20 w-24 shrink-0" aria-hidden="true">
              {previews.map((item, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- תמונונות חופפות בכרטיס
                <img
                  key={item.id}
                  src={toCdnUrl(item.thumbnail_url ?? item.url)}
                  alt=""
                  loading="lazy"
                  className="absolute top-1/2 h-16 w-12 -translate-y-1/2 rounded-[var(--radius-sm)] border-2 border-white object-cover shadow"
                  style={{ insetInlineStart: `${index * 1.35}rem`, zIndex: 3 - index, objectPosition: focal(item) }}
                />
              ))}
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-[1.0625rem] text-ink">
                {t('momentsCount', { count: media.length })}
              </span>
              <span className="mt-1 inline-block text-small font-semibold text-burgundy">
                {t('momentsCta')} ←
              </span>
            </span>
          </span>
        </button>
      </div>

      {/* ---- Desktop/Tablet: הפריסה העריכתית ---- */}
      <div className="hidden space-y-12 sm:block">
        {groups.map((group) => (
          <div key={group.id ?? 'opening'}>
            {group.title ? (
              <h3 className="mb-5 flex items-center gap-3 font-display text-[1.25rem] text-ink">
                <span aria-hidden="true" className="h-px w-8 bg-gold" />
                {group.title}
              </h3>
            ) : null}
            <div className="space-y-4">
              {composeRows(group.items).map((row, rowIndex) => (
                <div
                  key={row[0].id}
                  className={`grid gap-4 ${
                    row.length === 3
                      ? rowIndex % 2 === 0
                        ? 'grid-cols-[2fr_1fr]'
                        : 'grid-cols-[1fr_2fr]'
                      : row.length === 2
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                  }`}
                >
                  {row.length === 3 ? (
                    <>
                      <StoryTile item={row[0]} tall onOpen={openViewer} onView={trackView} />
                      <div className="grid gap-4">
                        <StoryTile item={row[1]} onOpen={openViewer} onView={trackView} />
                        <StoryTile item={row[2]} onOpen={openViewer} onView={trackView} />
                      </div>
                    </>
                  ) : (
                    row.map((item) => (
                      <StoryTile
                        key={item.id}
                        item={item}
                        solo={row.length === 1}
                        onOpen={openViewer}
                        onView={trackView}
                      />
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {viewerIndex != null ? (
        <MediaViewer
          media={media}
          index={viewerIndex}
          chapterName={chapterName}
          onNavigate={setViewerIndex}
          onClose={closeViewer}
          onView={trackView}
        />
      ) : null}

      {reelsOpen ? (
        <EventReels
          media={media}
          startIndex={reelsStart}
          chapterName={chapterName}
          onClose={() => setReelsOpen(false)}
          onView={trackView}
        />
      ) : null}
    </section>
  );
}

/* ------------------------------- אריח בודד ------------------------------- */

function StoryTile({
  item,
  solo,
  tall,
  onOpen,
  onView,
}: {
  item: Media;
  solo?: boolean;
  tall?: boolean;
  onOpen: (item: Media) => void;
  /** [1.14] מונה צפיות — נקרא פעם אחת כשהאריח נכנס לתצוגה בגלילה. */
  onView: (id: string) => void;
}) {
  const t = useTranslations('events');
  const viewRef = useInViewOnce<HTMLElement>(() => onView(item.id));
  const ar = ratio(item);

  if (item.type === 'video') {
    return (
      <div ref={viewRef as React.RefObject<HTMLDivElement>}>
        <StoryVideo item={item} />
      </div>
    );
  }

  // סולו רחבה — נשמר היחס המקורי (בלי חיתוך); בקומפוזיציות — object-cover
  // עם נקודת המיקוד שנבחרה בניהול.
  return (
    <button
      ref={viewRef as React.RefObject<HTMLButtonElement>}
      type="button"
      onClick={() => onOpen(item)}
      className="group relative w-full overflow-hidden rounded-[var(--radius-lg)] bg-cream-2 text-start focus-visible:ring-2 focus-visible:ring-gold/60"
      style={{ aspectRatio: solo ? Math.max(ar, 1.2) : tall ? 0.9 : ar < 0.85 ? 3 / 4 : 4 / 3 }}
      aria-label={item.alt_he ?? item.caption_he ?? t('gallery')}
    >
      <Img
        src={item.url}
        alt={item.alt_he ?? item.caption_he ?? ''}
        fill
        sizes={solo ? '(max-width: 1024px) 100vw, 1024px' : '(max-width: 1024px) 50vw, 512px'}
        className="object-cover transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-[1.015] motion-reduce:transform-none"
        style={{ objectPosition: focal(item) }}
      />
      {item.caption_he ? (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/75 to-transparent px-4 pb-3 pt-10 text-start text-caption text-cream opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:opacity-100">
          {item.caption_he}
        </span>
      ) : null}
    </button>
  );
}

function videoEmbedSrc(item: Media, autoplay: boolean): string {
  if (item.video_provider === 'vimeo' && item.video_id) {
    return `https://player.vimeo.com/video/${item.video_id}${autoplay ? '?autoplay=1&muted=1' : ''}`;
  }
  if (item.video_id) {
    return `https://www.youtube-nocookie.com/embed/${item.video_id}${autoplay ? '?autoplay=1&mute=1' : ''}`;
  }
  return item.url;
}

/** וידאו בפריסה — Cover עם כפתור הפעלה; iframe רק אחרי לחיצה. */
function StoryVideo({ item }: { item: Media }) {
  const t = useTranslations('events');
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] bg-navy">
      {playing ? (
        <iframe
          src={videoEmbedSrc(item, true)}
          title={item.caption_he ?? t('videoTitle')}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={item.caption_he ?? t('videoTitle')}
          className="group absolute inset-0"
        >
          {item.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- cover של וידאו חיצוני
            <img src={toCdnUrl(item.thumbnail_url)} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : null}
          <span className="absolute inset-0 bg-navy/30 transition-colors group-hover:bg-navy/20" />
          <span className="absolute start-1/2 top-1/2 flex h-16 w-16 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-cream/90 text-navy shadow-lg transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ms-1 h-6 w-6" fill="currentColor" aria-hidden="true">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
          </span>
          {item.caption_he ? (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/80 to-transparent px-4 pb-3 pt-10 text-start text-caption text-cream">
              {item.caption_he}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}

/* ------------------------------ Viewer מלא ------------------------------- */

function MediaViewer({
  media,
  index,
  chapterName,
  onNavigate,
  onClose,
  onView,
}: {
  media: Media[];
  index: number;
  chapterName: Map<string, string>;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onView: (id: string) => void;
}) {
  const t = useTranslations('events');
  const item = media[index];
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // [1.14] מונה צפיות — כל אינדקס שמוצג בפועל ב-Viewer נספר
  useEffect(() => {
    onView(item.id);
  }, [item.id, onView]);

  const step = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < media.length) onNavigate(next);
    },
    [index, media.length, onNavigate],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      // RTL: חץ שמאלה מתקדם
      else if (event.key === 'ArrowLeft') step(1);
      else if (event.key === 'ArrowRight') step(-1);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, step]);

  async function share() {
    const url = new URL(window.location.href);
    url.searchParams.set('media', item.id);
    try {
      if (navigator.share) await navigator.share({ url: url.toString() });
      else await navigator.clipboard.writeText(url.toString());
    } catch {
      /* ביטול שיתוף אינו שגיאה */
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('gallery')}
      className="fixed inset-0 z-[70] flex flex-col bg-navy/95 backdrop-blur-md"
      onPointerDown={(event) => {
        touchStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const dx = event.clientX - start.x;
        if (Math.abs(dx) > 60) step(dx > 0 ? -1 : 1);
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-cream">
        <span className="text-caption tabular-nums">
          {t('imageCounter', { index: index + 1, total: media.length })}
          {item.chapter_id && chapterName.get(item.chapter_id) ? (
            <span className="ms-2 text-cream/70">· {chapterName.get(item.chapter_id)}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={share}
            aria-label={t('share')}
            className="rounded-[var(--radius-pill)] p-2 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="M13.5 6.5 10 3m0 0L6.5 6.5M10 3v10m-6 1v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-[var(--radius-pill)] p-2 transition-colors hover:bg-white/10"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      </div>

      <div className="relative min-h-0 flex-1 px-3">
        {item.type === 'video' ? (
          <iframe
            src={videoEmbedSrc(item, true)}
            title={item.caption_he ?? t('videoTitle')}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="mx-auto aspect-video h-full max-h-full w-full max-w-5xl"
          />
        ) : (
          /* גובה מפורש למעטפת — fill בלי גובה מוגדר קורס ל-0 (הבאג
             שהיה בלייטבוקס הישן) */
          <div className="relative h-full w-full">
            <Img
              src={item.url}
              alt={item.alt_he ?? item.caption_he ?? ''}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        )}

        {index > 0 ? (
          <ViewerArrow dir="prev" label={t('prevImage')} onClick={() => step(-1)} />
        ) : null}
        {index < media.length - 1 ? (
          <ViewerArrow dir="next" label={t('nextImage')} onClick={() => step(1)} />
        ) : null}
      </div>

      <p className="min-h-12 px-6 py-3 text-center text-small text-cream/90">{item.caption_he ?? ''}</p>
    </div>
  );
}

function ViewerArrow({
  dir,
  label,
  onClick,
}: {
  dir: 'prev' | 'next';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-cream backdrop-blur transition-colors hover:bg-white/20 ${
        dir === 'prev' ? 'end-3' : 'start-3'
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        className={`h-5 w-5 ${dir === 'prev' ? '' : 'rotate-180'}`}
        fill="none"
        aria-hidden="true"
      >
        <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* ------------------------------- Reels ----------------------------------- */

function EventReels({
  media,
  startIndex,
  chapterName,
  onClose,
  onView,
}: {
  media: Media[];
  startIndex: number;
  chapterName: Map<string, string>;
  onClose: () => void;
  onView: (id: string) => void;
}) {
  const t = useTranslations('events');
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);

  // הפריט הפעיל נקבע לפי מה שתפוס במרכז המסך — scroll-snap עושה את השאר
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (startIndex > 0) {
      container.children[startIndex]?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const index = Number((entry.target as HTMLElement).dataset.index);
            if (!Number.isNaN(index)) {
              setActive(index);
              // [1.14] מונה צפיות — פריט Reels שהופך פעיל נחשב "נצפה"
              const viewedItem = media[index];
              if (viewedItem) onView(viewedItem.id);
            }
          }
        }
      },
      { root: container, threshold: 0.6 },
    );
    for (const child of container.children) observer.observe(child);
    document.body.style.overflow = 'hidden';
    return () => {
      observer.disconnect();
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- media/onView יציבים לאורך חיי ה-Reels
  }, [startIndex]);

  const activeItem = media[active];

  return (
    <div role="dialog" aria-modal="true" aria-label={t('gallery')} className="fixed inset-0 z-[70] bg-navy">
      {/* התקדמות + סגירה — מעל הרצף */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-navy/70 to-transparent px-4 pb-8 pt-3 text-cream">
        <span className="text-caption tabular-nums">
          {t('imageCounter', { index: active + 1, total: media.length })}
          {activeItem?.chapter_id && chapterName.get(activeItem.chapter_id) ? (
            <span className="ms-2 text-cream/75">· {chapterName.get(activeItem.chapter_id)}</span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="pointer-events-auto rounded-full bg-white/10 p-2"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-dvh snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {media.map((item, index) => (
          <div
            key={item.id}
            data-index={index}
            className="relative flex h-dvh snap-start items-center justify-center overflow-hidden"
          >
            {/* רקע מטושטש מאותה תמונה — כשהיחס אינו ממלא את המסך */}
            {item.type === 'image' ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- שכבת רקע מטושטשת */}
                <img
                  src={toCdnUrl(item.thumbnail_url ?? item.url)}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                />
                {Math.abs(index - active) <= 2 ? (
                  <Img
                    src={item.url}
                    alt={item.alt_he ?? item.caption_he ?? ''}
                    fill
                    sizes="100vw"
                    className="object-contain"
                    priority={index === active}
                  />
                ) : null}
              </>
            ) : Math.abs(index - active) <= 1 ? (
              <div className="relative aspect-video w-full">
                {index === active ? (
                  <iframe
                    src={videoEmbedSrc(item, true)}
                    title={item.caption_he ?? t('videoTitle')}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                ) : item.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- cover של וידאו
                  <img src={toCdnUrl(item.thumbnail_url)} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : null}
              </div>
            ) : null}

            {item.caption_he ? (
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/85 to-transparent px-5 pb-8 pt-14 text-center text-small text-cream">
                {item.caption_he}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
