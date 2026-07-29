'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { HeroSlide } from './types';

const INTERVAL = 7000;

/** מיפוי נקודת המיקוד למחלקת object-position. */
const FOCAL_CLASS: Record<string, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  start: 'object-right',
  end: 'object-left',
};

/**
 * הקרוסלה הפותחת.
 *
 * התוכן אמיתי בלבד: הפרוסות נבנות מספר שפורסם, מאירוע ומציר פעילות —
 * לא מתמונות מלאי. פרוסה בלי תמונה מקבלת טיפול טיפוגרפי במקום ריבוע ריק.
 *
 * נגישות (WCAG 2.2.2 — Pause, Stop, Hide): תוכן שמתחלף מעצמו חייב שליטה.
 * לכן יש כפתור השהיה, ההחלפה נעצרת במעבר עכבר ובמיקוד מקלדת, והיא כבויה
 * לחלוטין תחת prefers-reduced-motion. אזור החי מכריז על השקופית רק כשהוא
 * מושהה — הכרזה על תוכן שמתחלף לבדו מציפה קורא מסך.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const t = useTranslations('hero');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [manualPause, setManualPause] = useState(false);
  const regionRef = useRef<HTMLElement>(null);
  const id = useId();

  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || manualPause) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), INTERVAL);
    return () => window.clearInterval(timer);
  }, [count, paused, manualPause]);

  // חצים במקלדת כשהמיקוד בתוך הקרוסלה
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    }
  }

  if (count === 0) return null;

  const active = slides[index];
  const previous = slides[(index - 1 + count) % count];
  const next = slides[(index + 1) % count];

  return (
    <section
      ref={regionRef}
      aria-roledescription="carousel"
      aria-label={t('label')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      className="on-dark relative isolate overflow-hidden"
    >
      <div className="grid min-h-[30rem] lg:min-h-[34rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)_minmax(0,1fr)]">
        {/* שכנה קודמת — נרמזת בלבד, מוסתרת מהנגישות כי היא כפילות */}
        <NeighbourPanel slide={previous} onClick={() => go(index - 1)} label={t('previous')} />

        <div
          aria-live={paused || manualPause ? 'polite' : 'off'}
          aria-atomic="true"
          className="relative"
        >
          <ActivePanel slide={active} position={index + 1} total={count} />
        </div>

        <NeighbourPanel slide={next} onClick={() => go(index + 1)} label={t('next')} />
      </div>

      {/* פקדים */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-20 flex items-center justify-center gap-4">
        <div className="pointer-events-auto flex items-center gap-2.5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => go(i)}
              aria-label={t('goTo', { index: i + 1, title: slide.title })}
              aria-current={i === index ? 'true' : undefined}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? 'w-7 bg-gold' : 'w-1.5 bg-white/45 hover:bg-white/70'
              }`}
            />
          ))}
        </div>

        {count > 1 ? (
          <button
            type="button"
            onClick={() => setManualPause((value) => !value)}
            aria-pressed={manualPause}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full border border-white/30 text-white/80 transition-colors hover:border-gold hover:text-gold"
            aria-label={manualPause ? t('play') : t('pause')}
          >
            {manualPause ? (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <path d="M3 1.5v9l7-4.5z" />
              </svg>
            ) : (
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                <rect x="3" y="2" width="2.5" height="8" />
                <rect x="6.5" y="2" width="2.5" height="8" />
              </svg>
            )}
          </button>
        ) : null}
      </div>

      {/* חצים — מוצגים גם במובייל, שם אין שכנות ללחוץ עליהן */}
      {count > 1 ? (
        <>
          <ArrowButton side="start" onClick={() => go(index - 1)} label={t('previous')} />
          <ArrowButton side="end" onClick={() => go(index + 1)} label={t('next')} />
        </>
      ) : null}

      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {t('status', { index: index + 1, total: count })}
      </span>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ActivePanel({
  slide,
  position,
  total,
}: {
  slide: HeroSlide;
  position: number;
  total: number;
}) {
  const isBook = slide.kind === 'book';

  return (
    <article
      aria-roledescription="slide"
      aria-label={`${position} מתוך ${total}`}
      className="relative flex h-full flex-col justify-center overflow-hidden px-6 py-16 text-center sm:px-10 lg:py-20"
    >
      {/* רקע: לספר — כהה ונקי, כדי שהכריכה תישא את המסגרת.
          לאירוע ולפעילות — הצילום עצמו מתחת לשכבת כיסוי. */}
      {!isBook && slide.imageUrl ? (
        <div className="media-backdrop absolute inset-0 -z-10">
          {/* תמונת נייד נפרדת כשהועלתה: קידוד תמונה רחבה למסך צר חותך את
              מרכז העניין. picture נותן לדפדפן לבחור לפני ההורדה. */}
          {slide.imageMobileUrl ? (
            <picture>
              <source media="(min-width: 768px)" srcSet={slide.imageUrl} />
              <img
                src={slide.imageMobileUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </picture>
          ) : (
            <Image
              src={slide.imageUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className={`object-cover ${FOCAL_CLASS[slide.focalPoint ?? 'center']}`}
            />
          )}
          <div className="absolute inset-0 bg-navy/72" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,var(--color-navy-2)_0%,var(--color-navy)_72%)]"
        />
      )}

      {isBook && slide.imageUrl ? (
        <div className="mx-auto mb-7 w-[11rem] sm:w-[13rem] lg:w-[15.5rem]">
          <Image
            src={slide.imageUrl}
            alt={slide.imageAlt}
            width={420}
            height={560}
            priority
            sizes="(max-width: 640px) 176px, 248px"
            className="h-auto w-full object-contain drop-shadow-[0_22px_36px_rgb(0_0_0_/_0.55)]"
          />
        </div>
      ) : null}

      <p className="eyebrow">{slide.eyebrow}</p>
      <h2 className="mx-auto mt-3 max-w-[18ch] font-serif text-[clamp(1.75rem,4.6vw,2.75rem)] leading-[1.15] text-white">
        {slide.title}
      </h2>
      {slide.summary ? (
        <p className="mx-auto mt-4 max-w-[46ch] text-small leading-relaxed text-cream-2/85 sm:text-body">
          {slide.summary}
        </p>
      ) : null}

      {slide.href && slide.ctaLabel ? (
        <p className="mt-7">
          {/* קישור חיצוני יוצא מ-Next Link — הוא אינו מסלול פנימי */}
          {slide.href.startsWith('http') ? (
            <a href={slide.href} target="_blank" rel="noopener noreferrer" className="btn btn-quiet">
              {slide.ctaLabel}
            </a>
          ) : (
            <Link href={slide.href} className="btn btn-quiet">
              {slide.ctaLabel}
            </Link>
          )}
        </p>
      ) : null}
    </article>
  );
}

/**
 * פאנל שכן — רמז ויזואלי למה שיבוא. מוסתר מקוראי מסך: הוא כפילות של
 * שקופית שממילא תגיע, והכפתורים הייעודיים כבר מספקים את הניווט.
 */
function NeighbourPanel({
  slide,
  onClick,
  label,
}: {
  slide: HeroSlide;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      aria-hidden="true"
      title={label}
      className="group relative hidden overflow-hidden lg:block"
    >
      {slide.imageUrl ? (
        <Image
          src={slide.imageUrl}
          alt=""
          fill
          sizes="25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <span className="absolute inset-0 bg-navy-2" />
      )}
      <span className="absolute inset-0 bg-navy/78 transition-colors duration-300 group-hover:bg-navy/64" />

      <span className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span className="eyebrow">{slide.eyebrow}</span>
        <span className="mt-2 max-w-[16ch] font-serif text-[1.125rem] leading-snug text-white/90">
          {slide.title}
        </span>
      </span>
    </button>
  );
}

function ArrowButton({
  side,
  onClick,
  label,
}: {
  side: 'start' | 'end';
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/25 text-white/80 backdrop-blur-[2px] transition-colors hover:border-gold hover:text-gold ${
        side === 'start' ? 'start-3 lg:start-6' : 'end-3 lg:end-6'
      }`}
    >
      {/* החץ מצביע תמיד החוצה, אל צדו שלו. הצורה משורטטת ל-LTR ומתהפכת
          בעברית, אחרת "הקודם" בצד ימין היה מצביע פנימה. */}
      <svg viewBox="0 0 20 20" className="h-5 w-5 rtl:-scale-x-100" fill="none" aria-hidden="true">
        <path
          d={side === 'start' ? 'M12 4l-6 6 6 6' : 'M8 4l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
