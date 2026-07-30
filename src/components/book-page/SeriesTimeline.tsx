import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { SectionHeading } from '@/components/SectionHeading';
import { localized } from '@/lib/localized';
import type { BookWithRelations, Series } from '@/lib/supabase/types';

/**
 * ציר הסדרה: כל הכרכים לפי סדר, עם סימון "הספר שלפניכם" על הכרך הנוכחי.
 * לא קרוסלת "ספרים קשורים" רגילה — סדר הוא בדיוק המידע שהופך את זה
 * לסדרה ולא לרשימת ספרים מאותו מחבר.
 */
export function SeriesTimeline({
  series,
  currentBook,
  volumes,
  locale,
  t,
}: {
  series: Pick<Series, 'id' | 'slug' | 'name_he' | 'name_en'>;
  currentBook: BookWithRelations;
  volumes: BookWithRelations[];
  locale: string;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const seriesName = localized(series, 'name', locale);
  const all = [...volumes, currentBook].sort(
    (a, b) => (a.series_position ?? 999) - (b.series_position ?? 999),
  );

  return (
    <section aria-labelledby="book-series">
      <SectionHeading level={2} eyebrow={t('seriesIntro')} title={seriesName} id="book-series" />
      <ol className="flex gap-6 overflow-x-auto pb-2">
        {all.map((volume) => {
          const isCurrent = volume.id === currentBook.id;
          const title = localized(volume, 'title', locale);
          const content = (
            <>
              <div
                className={`relative transition-transform duration-300 ${
                  isCurrent ? '' : 'group-hover:-translate-y-1'
                }`}
              >
                <BookCover
                  src={volume.cover_image_url}
                  title={title}
                  alt={t('coverAlt', { title })}
                  sizes="140px"
                />
                {isCurrent ? (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-pill)] bg-burgundy px-2.5 py-0.5 text-caption text-white">
                    {t('seriesCurrentVolume')}
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-caption text-muted">
                {volume.series_position ? t('seriesVolume', { n: volume.series_position }) : null}
              </p>
              <h3 className="line-clamp-2 text-small leading-snug text-ink">{title}</h3>
            </>
          );

          return (
            <li key={volume.id} className="w-28 shrink-0 sm:w-36">
              {isCurrent ? (
                <div className="cursor-default">{content}</div>
              ) : (
                <Link href={`/books/${volume.slug}`} className="group block focus-visible:outline-offset-4">
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
