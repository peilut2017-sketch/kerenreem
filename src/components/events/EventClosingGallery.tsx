'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Img as Image } from '@/components/Img';
import { LightboxTrigger } from './EventLightbox';
import type { LightboxImage } from './EventLightbox';

const THRESHOLD = 40;
const INITIAL_COUNT = 15;

/**
 * "Intelligent Gallery": מעל 40 תמונות בגלריה המסיימת לא מוצגות כולן
 * בבת אחת — רק ה-15 הראשונות (מה שהעורך שם ראשון, בהנחה שהחזק ביותר
 * מוצג קודם), ואז כפתור מפורש להמשיך. מתחת לסף, אין טעם להסתיר דבר.
 */
export function EventClosingGallery({
  images,
  startIndex,
}: {
  images: LightboxImage[];
  startIndex: number;
}) {
  const t = useTranslations('events');
  const [expanded, setExpanded] = useState(images.length <= THRESHOLD);
  const shown = expanded ? images : images.slice(0, INITIAL_COUNT);

  if (images.length === 0) return null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {shown.map((image, position) => (
          <LightboxTrigger key={image.url} index={startIndex + position}>
            {(open) => (
              <button
                type="button"
                onClick={open}
                className="group relative block aspect-square w-full overflow-hidden rounded-[var(--radius-md)]"
              >
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
              </button>
            )}
          </LightboxTrigger>
        ))}
      </div>

      {!expanded ? (
        <div className="mt-8 text-center">
          <p className="mb-3 text-small text-muted">{t('closingGalleryLead')}</p>
          <button type="button" onClick={() => setExpanded(true)} className="btn btn-quiet">
            {t('showFullGallery', { count: images.length - INITIAL_COUNT })}
          </button>
        </div>
      ) : null}
    </div>
  );
}
