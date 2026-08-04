import { Img as Image } from '@/components/Img';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '../Reveal';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { parseDateOnly, toHebrewDayMonth, toHebrewYear, toIsoDate } from '@/lib/hebrew-date';
import type { EventRecord } from '@/lib/supabase/types';

/**
 * כרטיס אירוע — משותף לשורת "אירועים אחרונים" בעמוד הבית ולעמוד רשימת
 * האירועים המלא. לוח התאריכים הוא הגיבור: מספר היום גדול, ולצדו החודש
 * והשנה העברית — כך שקוראים "ט״ו באב תשפ״ו" בסריקה אחת. התאריך הלועזי
 * מופיע מתחת, קטן, כמשלים (ראו EventsRow.tsx, שממנו חולץ הכרטיס הזה).
 *
 * אירוע בלי כריכה מקבל "שער" כהה עם התאריך והשם — לא מלבן ריק — כמו
 * שכריכת ספר חסרה מקבלת שער טיפוגרפי (ראו BookCover.tsx).
 */
export async function EventCard({
  event,
  locale,
  priority = false,
  delay = 0,
  showExcerpt = false,
}: {
  event: EventRecord;
  locale: string;
  priority?: boolean;
  delay?: number;
  /** תקציר קצר מהגוף — מוצג בעמוד רשימת האירועים, לא בתקציר הבית (מקום מצומצם). */
  showExcerpt?: boolean;
}) {
  const t = await getTranslations();
  const date = parseDateOnly(event.event_date ?? '');
  const title = localized(event, 'title', locale);
  const excerpt = showExcerpt ? htmlToPlainText(localized(event, 'body', locale), 140) : '';

  return (
    <Reveal as="li" delay={delay}>
      <Link
        href={`/events/${event.slug}`}
        className="card card-interactive group h-full focus-visible:outline-offset-4"
      >
        <div className="relative aspect-16/10 overflow-hidden bg-navy-2">
          {event.cover_image_url ? (
            <Image
              src={event.cover_image_url}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-[900ms] ease-[var(--ease-spring)] group-hover:scale-[1.06]"
            />
          ) : (
            <div className="on-dark flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center">
              <span aria-hidden="true" className="font-serif text-[2rem] leading-none text-gold-bright">
                {date ? toHebrewDayMonth(date).split(' ')[0] : '✶'}
              </span>
              <span className="line-clamp-2 font-serif text-[1.0625rem] leading-snug text-cream">
                {title}
              </span>
            </div>
          )}

          {/* לוח התאריך יושב על התמונה, בפינת הפתיחה. תאריך עברי קבוע
              (event_date_he, לאירוע שנתי) מוצג כטקסט פשוט — אין ממנו יום
              וחודש נפרדים לפצל אותם למספר גדול כמו בתאריך הנגזר מ-Date. */}
          {date ? (
            <time
              dateTime={toIsoDate(date)}
              className="glass absolute bottom-3 start-3 flex items-baseline gap-2 rounded-[var(--radius-sm)] px-3.5 py-2"
            >
              <span className="font-serif text-[1.75rem] leading-none tabular-nums text-ink">
                {toHebrewDayMonth(date).split(' ')[0]}
              </span>
              <span className="text-caption leading-tight text-muted">
                <span className="block">{toHebrewDayMonth(date).split(' ').slice(1).join(' ')}</span>
                <span className="block">{toHebrewYear(date)}</span>
              </span>
            </time>
          ) : event.event_date_he ? (
            <span className="glass absolute bottom-3 start-3 rounded-[var(--radius-sm)] px-3.5 py-2 font-serif text-[1.0625rem] text-ink">
              {event.event_date_he}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-6">
          <h3 className="font-serif text-h3 leading-snug text-ink transition-colors group-hover:text-burgundy">
            {title}
          </h3>
          {date ? (
            <p className="mt-2 text-caption text-muted">
              {new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                timeZone: 'Asia/Jerusalem',
              }).format(date)}
            </p>
          ) : null}
          {excerpt ? (
            <p className="mt-3 line-clamp-2 text-small leading-relaxed text-ink-soft">{excerpt}</p>
          ) : null}
          <span className="link-more mt-auto pt-5">{t('home.eventDetails')}</span>
        </div>
      </Link>
    </Reveal>
  );
}
