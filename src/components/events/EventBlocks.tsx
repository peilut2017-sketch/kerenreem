'use client';

import { useState } from 'react';
import Image from 'next/image';
import { VideoEmbed, getYouTubeThumbnail } from '../VideoEmbed';
import { ScrollFocus } from './ScrollFocus';
import { LightboxTrigger } from './EventLightbox';
import type { EventBlockImage } from '@/lib/supabase/types';

/** גוף פסקה — בלי ScrollFocus: הוא נועד למדיה, לא לטקסט קריא. */
export function EventTextBlock({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-[42rem] whitespace-pre-line text-body leading-relaxed text-ink-soft">
      {text}
    </div>
  );
}

export function EventImageBlock({
  url,
  alt,
  caption,
  imageIndex,
}: {
  url: string;
  alt: string;
  caption: string | null;
  imageIndex: number;
}) {
  return (
    <LightboxTrigger index={imageIndex}>
      {(open) => (
        <ScrollFocus>
          <button
            type="button"
            onClick={open}
            className="group relative block w-full overflow-hidden rounded-[var(--radius-lg)]"
          >
            <div className="relative aspect-[16/10] w-full">
              <Image
                src={url}
                alt={alt}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
              />
            </div>
            {caption ? (
              <span className="scroll-focus-caption absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy/75 to-transparent px-5 py-4 text-start text-small text-cream">
                {caption}
              </span>
            ) : null}
          </button>
        </ScrollFocus>
      )}
    </LightboxTrigger>
  );
}

/** גיוון דטרמיניסטי — אותה תמונה תמיד מקבלת אותה צורה, בלי טבלת גדלים ידנית. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

const SHAPES = [
  { aspect: 'aspect-square', grow: 'flex-[1]' },
  { aspect: 'aspect-video', grow: 'flex-[1.7]' },
  { aspect: 'aspect-[3/4]', grow: 'flex-[0.85]' },
] as const;

/**
 * שורת מוזאיקה — 2 עד 4 תמונות. הצורה של כל תמונה (מרובע/רחב/אנכי)
 * נגזרת מגיבוב כתובת התמונה עצמה, כך שאין שתי שורות נראות זהות בלי
 * שהעורך צריך לבחור "גודל תצוגה" בעצמו.
 */
export function EventImageRowBlock({
  images,
  indexes,
}: {
  images: EventBlockImage[];
  indexes: number[];
}) {
  return (
    <ScrollFocus>
      <div className="flex flex-wrap items-start gap-3">
        {images.map((image, position) => {
          const shape = SHAPES[hashString(image.url) % SHAPES.length];
          return (
            <LightboxTrigger
              key={image.url}
              index={indexes[position]}
              className={`min-w-[45%] ${shape.grow}`}
            >
              {(open) => (
                <button
                  type="button"
                  onClick={open}
                  className={`group relative block w-full overflow-hidden rounded-[var(--radius-lg)] ${shape.aspect}`}
                >
                  <Image
                    src={image.url}
                    alt={image.alt ?? ''}
                    fill
                    sizes="(max-width: 768px) 50vw, 400px"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </button>
              )}
            </LightboxTrigger>
          );
        })}
      </div>
    </ScrollFocus>
  );
}

export function EventVideoBlock({
  url,
  caption,
  title,
}: {
  url: string;
  caption: string | null;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  const thumbnail = getYouTubeThumbnail(url);

  return (
    <ScrollFocus>
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-navy">
        {playing ? (
          <VideoEmbed url={url} title={title} className="rounded-none border-0" />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group relative block aspect-video w-full"
            aria-label={`נגינת הסרטון — ${title}`}
          >
            {thumbnail ? (
              <Image
                src={thumbnail}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-2 to-burgundy-deep" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-navy/25 transition-colors group-hover:bg-navy/40">
              <span className="flex h-16 w-16 items-center justify-center rounded-[var(--radius-pill)] bg-cream/95 text-burgundy shadow-[var(--shadow-float)] transition-transform duration-300 group-hover:scale-105">
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 translate-x-0.5" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      {caption ? <p className="scroll-focus-caption mt-2 text-center text-caption text-muted">{caption}</p> : null}
    </ScrollFocus>
  );
}

export function EventQuoteBlock({ text, attribution }: { text: string; attribution: string | null }) {
  return (
    <ScrollFocus>
      <blockquote className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-gold/30 bg-gradient-to-br from-cream to-cream-2 px-8 py-10 text-center shadow-[var(--shadow-float)]">
        <p className="font-serif text-h3 leading-relaxed text-ink">&ldquo;{text}&rdquo;</p>
        {attribution ? <footer className="mt-4 text-small text-muted">— {attribution}</footer> : null}
      </blockquote>
    </ScrollFocus>
  );
}
