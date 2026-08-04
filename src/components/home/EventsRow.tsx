import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { EventCard } from '../events/EventCard';
import type { EventRecord } from '@/lib/supabase/types';

/**
 * שלושת האירועים האחרונים. הכרטיס עצמו (EventCard) משותף עם עמוד רשימת
 * האירועים המלא — כאן בלי תקציר, כדי להישאר קומפקטי בעמוד הבית.
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

        {/* גובה אחיד לכל הכרטיסים: h-full על הקישור בתוך EventCard, ותוכן
            שנדחף לתחתית ב-mt-auto. כרטיסים בגבהים שונים שוברים את השורה. */}
        <ul className="mt-14 grid gap-6 md:grid-cols-3">
          {events.slice(0, 3).map((event, index) => (
            <EventCard key={event.id} event={event} locale={locale} delay={index * 90} priority={index === 0} />
          ))}
        </ul>
      </div>
    </section>
  );
}
