'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';

export interface LightboxImage {
  url: string;
  alt: string;
  caption: string | null;
}

const LightboxContext = createContext<((index: number) => void) | null>(null);
const ActiveIndexContext = createContext<number | null>(null);

/** נקרא מתוך כל רכיב שמציג תמונה, כדי לפתוח אותה במגירה הצפה. */
export function useOpenLightbox(): (index: number) => void {
  const open = useContext(LightboxContext);
  if (!open) throw new Error('useOpenLightbox חייב לרוץ בתוך EventLightboxProvider');
  return open;
}

/** האינדקס הפתוח כרגע במגירה, או null כשהיא סגורה. */
export function useActiveLightboxIndex(): number | null {
  return useContext(ActiveIndexContext);
}

/**
 * המעבר בין תצוגה רגילה למגירה נעשה עם View Transitions API כשהדפדפן
 * תומך בו: הדפדפן עצמו מבצע cross-fade חלק בין שני מצבי ה-DOM, בלי שום
 * ספריית אנימציה. בלי תמיכה (Safari/Firefox ישנים), הפעולה קורית מיד —
 * עדיין תקין, רק בלי המעבר החלק.
 */
function runViewTransition(update: () => void) {
  const withTransition = (document as Document & { startViewTransition?: (cb: () => void) => void })
    .startViewTransition;
  if (withTransition) withTransition.call(document, update);
  else update();
}

/**
 * מספק לכל צאצא דרך לפתוח את המגירה הצפה, עם רשימת התמונות המאוחדת של
 * כל האירוע — בלוקים, פס הזיכרונות והגלריה המסיימת יחד, אינדקס אחד
 * לכולם. כך "הבא/הקודם" בתוך המגירה עובר בין כל תמונות האירוע ולא רק
 * בתוך הקבוצה שבה נלחץ.
 */
export function EventLightboxProvider({
  images,
  children,
}: {
  images: LightboxImage[];
  children: React.ReactNode;
}) {
  const [index, setIndex] = useState<number | null>(null);

  const open = useCallback((next: number) => {
    runViewTransition(() => setIndex(next));
  }, []);

  const close = useCallback(() => {
    runViewTransition(() => setIndex(null));
  }, []);

  const step = useCallback(
    (delta: number) => {
      runViewTransition(() =>
        setIndex((current) => {
          if (current === null || images.length === 0) return current;
          return (current + delta + images.length) % images.length;
        }),
      );
    },
    [images.length],
  );

  return (
    <LightboxContext.Provider value={open}>
      <ActiveIndexContext.Provider value={index}>
        {children}
        {index !== null && images[index] ? (
          <LightboxOverlay images={images} index={index} onClose={close} onStep={step} />
        ) : null}
      </ActiveIndexContext.Provider>
    </LightboxContext.Provider>
  );
}

function LightboxOverlay({
  images,
  index,
  onClose,
  onStep,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onStep: (delta: number) => void;
}) {
  const t = useTranslations('events');
  const touchStartX = useRef<number | null>(null);
  const image = images[index];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      // RTL: ← חזותית הוא "הבא" (ימין לשמאל), חץ מקלדת נשאר לפי כיוונו הפיזי
      else if (event.key === 'ArrowRight') onStep(-1);
      else if (event.key === 'ArrowLeft') onStep(1);
    }
    document.addEventListener('keydown', onKeyDown);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, onStep]);

  function onWheel(event: React.WheelEvent) {
    if (Math.abs(event.deltaY) < 24) return;
    onStep(event.deltaY > 0 ? 1 : -1);
  }

  function onTouchStart(event: React.TouchEvent) {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (start === null || end === undefined) return;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    onStep(delta > 0 ? -1 : 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.caption ?? image.alt}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-navy/85 backdrop-blur-md"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button type="button" aria-label={t('close')} onClick={onClose} className="absolute inset-0" />

      <button
        type="button"
        onClick={() => onStep(1)}
        aria-label={t('nextImage')}
        className="absolute start-3 top-1/2 z-10 -translate-y-1/2 rounded-[var(--radius-pill)] bg-white/10 p-3 text-white transition-colors hover:bg-white/20 sm:start-6"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none">
          <path d="M12 4 6 10l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onStep(-1)}
        aria-label={t('prevImage')}
        className="absolute end-3 top-1/2 z-10 -translate-y-1/2 rounded-[var(--radius-pill)] bg-white/10 p-3 text-white transition-colors hover:bg-white/20 sm:end-6"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none">
          <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onClose}
        aria-label={t('close')}
        className="absolute end-3 top-3 z-10 rounded-[var(--radius-pill)] bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 sm:end-6 sm:top-6"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none">
          <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        </svg>
      </button>

      <figure
        key={index}
        className="relative z-[1] mx-auto flex max-h-[85vh] w-full max-w-5xl flex-col items-center px-4"
      >
        <div className="relative max-h-[75vh] w-full flex-1">
          <Image
            src={image.url}
            alt={image.alt}
            fill
            sizes="90vw"
            className="object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
            priority
          />
        </div>
        {image.caption ? (
          <figcaption className="mt-4 max-w-2xl text-center text-small text-white/80">{image.caption}</figcaption>
        ) : null}
        <p className="mt-2 text-caption tabular-nums text-white/50">
          {t('imageCounter', { index: index + 1, total: images.length })}
        </p>
      </figure>
    </div>
  );
}

/**
 * עוטף כל תמונה שניתנת ללחיצה, ומעדן אותה קלות בזמן שהמגירה פתוחה על
 * האינדקס שלה — כך ברור מאיפה "יצאה" התמונה הגדולה.
 *
 * לא ניסינו לתת ל-view-transition-name משותף בין התמונה הקטנה לגדולה
 * (shared-element transition אמיתי): שני האלמנטים היו קיימים בו-זמנית
 * ב-DOM עם אותו שם ברגע שהמגירה פתוחה, וזו שגיאת "duplicate
 * view-transition-name" אמיתית בדפדפן, לא רק אזהרה קוסמטית — נבדק בפועל.
 * ה-cross-fade הגלובלי של runViewTransition (ברירת המחדל של הדפדפן, בלי
 * שמות משותפים) עדיין נותן מעבר חלק, בלי הסיכון הזה.
 */
export function LightboxTrigger({
  index,
  className,
  style,
  children,
}: {
  index: number;
  className?: string;
  style?: React.CSSProperties;
  children: (open: () => void) => React.ReactNode;
}) {
  const open = useOpenLightbox();
  const activeIndex = useActiveLightboxIndex();
  const isActive = activeIndex === index;
  return (
    <div
      style={style}
      className={`transition-opacity duration-300 ${isActive ? 'opacity-60' : ''} ${className ?? ''}`}
    >
      {children(() => open(index))}
    </div>
  );
}
