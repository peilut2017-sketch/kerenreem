import { Link } from '@/i18n/navigation';
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
      {/*
        בלי overflow-x-auto בכוונה: כשהציר משותף בעמודה ברוחב חצי (לצד
        AuthorSection, ראו books/[slug]/page.tsx), סדרה של יותר מ-3-4
        כרכים לא נכנסת ברוחב הנתון ודורשת גרירה אופקית כדי לראות את
        השאר — בדיוק התלונה שהובילה לתיקון הזה. flex-wrap מעביר כרכים
        עודפים לשורה נוספת במקום להסתיר אותם מאחורי גלילה; אין צורך
        בגלילה אנכית או אופקית כדי לראות את הסדרה כולה.
      */}
      <ol className="flex flex-wrap items-start gap-x-1 gap-y-7">
        {all.map((volume) => {
          const isCurrent = volume.id === currentBook.id;
          const title = localized(volume, 'title', locale);
          const content = (
            <>
              <span
                aria-hidden="true"
                className={`relative z-10 mx-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 font-serif text-small transition-colors ${
                  isCurrent
                    ? 'border-navy bg-navy text-gold-bright'
                    : 'border-rule bg-cream text-muted group-hover:border-gold-deep group-hover:text-gold-deep'
                }`}
              >
                {volume.series_position ?? '·'}
              </span>
              <p className="mt-3.5 line-clamp-2 text-small leading-snug text-ink">{title}</p>
              <p className="mt-0.5 text-caption text-muted">
                {volume.series_position ? t('seriesVolume', { n: volume.series_position }) : null}
              </p>
              {isCurrent ? <p className="mt-1.5 text-caption text-gold-deep">{t('seriesCurrentVolume')}</p> : null}
            </>
          );

          return (
            <li key={volume.id} className="relative min-w-32 shrink-0 px-2 text-center sm:min-w-40">
              <span aria-hidden="true" className="absolute start-0 end-0 top-4 -z-0 h-px bg-rule" />
              {isCurrent ? (
                <div className="group cursor-default">{content}</div>
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
