'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Img as Image } from '@/components/Img';
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

/** יחסי רוחב אפשריים לאריח במוזאיקה — פנורמי, מרובע, אנכי. */
const TILE_RATIOS = [1.6, 1, 0.75] as const;

/**
 * שורת מוזאיקה — 2 עד 4 תמונות. הצורה של כל תמונה נגזרת מגיבוב כתובת
 * התמונה עצמה, כך שאין שתי שורות שנראות זהות בלי שהעורך צריך לבחור
 * "גודל תצוגה" בעצמו.
 *
 * שורה מיושרת בגובה אחיד, לא flex-wrap עם aspect לכל אריח. הניסיון
 * הקודם (min-width + aspect שונה לכל אריח) נמדד בפועל והתברר כשבור:
 * שלוש תמונות התפרסו כ-302×403 ו-358×201 בשורה אחת — חור לבן ענק מתחת
 * לנמוכה — והשלישית גלשה לשורה משלה ונמתחה ל-672 פיקסלים, פי שניים
 * מהשכנות. גובה קבוע + flex-grow לפי יחס הרוחב נותן בדיוק את אותו גיוון
 * ברוחבים, אבל השורה תמיד נסגרת ישרה ואף פעם לא נשאר חור.
 *
 * בנייד השורה הופכת לרשת של שתיים: ארבע תמונות בשורה אחת על מסך צר הן
 * ארבע בולים שאי אפשר לראות בהם דבר.
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
      <div className="grid grid-cols-2 gap-3 sm:flex sm:h-64 sm:items-stretch md:h-72">
        {images.map((image, position) => (
          <LightboxTrigger
            key={image.url}
            index={indexes[position]}
            className="min-h-0 [&>*]:h-full"
            style={{ flexGrow: TILE_RATIOS[hashString(image.url) % TILE_RATIOS.length], flexBasis: 0 }}
          >
            {(open) => (
              <button
                type="button"
                onClick={open}
                className="group relative block aspect-square w-full overflow-hidden rounded-[var(--radius-lg)] sm:aspect-auto sm:h-full"
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
        ))}
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
  const t = useTranslations('events');
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
            aria-label={t('playVideo', { title })}
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

/**
 * ציטוט "על קלף". במכוון בלי ScrollFocus: עמעום בהירות על טקסט הוא
 * הורדת ניגודיות, ולציטוט אין שום תועלת מזה — הוא לא מתחרה על תשומת
 * לב עם תמונות שכנות אלא עוצר את הרצף.
 */
export function EventQuoteBlock({ text, attribution }: { text: string; attribution: string | null }) {
  return (
    <blockquote className="mx-auto max-w-2xl rounded-[var(--radius-lg)] border border-gold/30 bg-gradient-to-br from-cream to-cream-2 px-8 py-10 text-center shadow-[var(--shadow-float)]">
      <p className="font-serif text-h3 leading-relaxed text-ink">&ldquo;{text}&rdquo;</p>
      {attribution ? <footer className="mt-4 text-small text-muted">— {attribution}</footer> : null}
    </blockquote>
  );
}
