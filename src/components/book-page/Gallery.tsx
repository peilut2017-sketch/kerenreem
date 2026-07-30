import Image from 'next/image';
import { SectionHeading } from '@/components/SectionHeading';
import type { BookImage } from '@/lib/supabase/types';

/**
 * גלריית תמונות נוספות (לא הכריכה עצמה — היא כבר ב-Hero). כל תמונה
 * נפתחת בגודל מלא בכרטיסייה חדשה: לא נבנה כאן lightbox שלם עבור תכונה
 * שהיא תוספת ולא הליבה של העמוד.
 */
export function Gallery({
  images,
  title,
  t,
}: {
  images: BookImage[];
  title: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  if (images.length === 0) return null;

  return (
    <section aria-labelledby="book-gallery">
      <SectionHeading level={2} title={t('navGallery')} id="book-gallery" />
      <div className="flex gap-4 overflow-x-auto pb-2">
        {images.map((image, index) => (
          <a
            key={image.id}
            href={image.image_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-40 shrink-0 sm:w-52"
          >
            <span className="relative block aspect-3/4 overflow-hidden rounded-[var(--radius-md)] bg-cream-2 shadow-[var(--shadow-soft)] transition-transform duration-300 group-hover:-translate-y-1">
              <Image
                src={image.image_url}
                alt={image.alt || t('galleryImageAlt', { index: index + 1, title })}
                fill
                sizes="208px"
                className="object-cover"
              />
            </span>
            {image.caption_he ? (
              <span className="mt-2 block text-caption text-muted">{image.caption_he}</span>
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}
