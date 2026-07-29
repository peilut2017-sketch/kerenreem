import Image from 'next/image';
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
    <section className="bg-cream-2 py-20 lg:py-24">
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

        <ul className="mt-12 grid gap-7 md:grid-cols-3">
          {events.slice(0, 3).map((event, index) => {
            const date = parseDateOnly(event.event_date ?? '');
            const title = localized(event, 'title', locale);

            return (
              <Reveal as="li" key={event.id} delay={index * 90}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group flex h-full flex-col border border-rule bg-cream transition-colors duration-300 hover:border-rule-strong focus-visible:outline-offset-4"
                >
                  <div className="relative aspect-16/10 overflow-hidden bg-navy-2">
                    {event.cover_image_url ? (
                      <Image
                        src={event.cover_image_url}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    ) : null}

                    {/* לוח התאריך יושב על התמונה, בפינת הפתיחה */}
                    {date ? (
                      <time
                        dateTime={toIsoDate(date)}
                        className="absolute bottom-0 start-0 flex items-baseline gap-2 bg-cream/95 px-4 py-2.5 backdrop-blur-sm"
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

                  <div className="flex flex-1 flex-col p-5">
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
