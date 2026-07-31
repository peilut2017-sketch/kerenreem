import { Img as Image } from '@/components/Img';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Reveal } from '../Reveal';
import { localized } from '@/lib/localized';
import { parseDateOnly, toHebrewDayMonth, toHebrewYear, toIsoDate } from '@/lib/hebrew-date';
import type { EventRecord } from '@/lib/supabase/types';

/**
 * שלושת האירועים האחרונים.
 *
 * לוח התאריכים הוא הגיבור: מספר היום גדול, ולצדו החודש והשנה העברית —
 * כך שקוראים "ט״ו באב תשפ״ו" בסריקה אחת. התאריך הלועזי מופיע מתחת,
 * קטן, כמשלים.
 */
export async function EventsRow({ events, locale }: { events: EventRecord[]; locale: string }) {
  const t = await getTranslations();
  if (events.length === 0) return null;

  return (
    <section className="section-y">
      <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('home.eventsLead')}</p>
            <h2 className="mt-2 font-serif text-[clamp(1.625rem,3.2vw,2.125rem)] text-ink">
              {t('home.eventsTitle')}
            </h2>
          </div>
          <Link href="/events" className="link-more">
            {t('home.eventsAll')}
          </Link>
        </header>

        {/* גובה אחיד לכל הכרטיסים: h-full על הקישור, ותוכן שנדחף
            לתחתית ב-mt-auto. כרטיסים בגבהים שונים שוברים את השורה. */}
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {events.slice(0, 3).map((event, index) => {
            const date = parseDateOnly(event.event_date ?? '');
            const title = localized(event, 'title', locale);

            return (
              <Reveal as="li" key={event.id} delay={index * 90}>
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
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-[900ms] ease-[var(--ease-spring)] group-hover:scale-[1.06]"
                      />
                    ) : null}

                    {/* לוח התאריך יושב על התמונה, בפינת הפתיחה */}
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
                    <span className="link-more mt-auto pt-5">{t('home.eventDetails')}</span>
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
