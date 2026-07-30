import { HebrewDate } from '@/components/HebrewDate';
import { EventHeroBackground } from './EventHeroBackground';
import type { EventRecord } from '@/lib/supabase/types';

/**
 * Hero גדול לעמוד האירוע: תמונת השער ממלאה את הרקע, הכותרת יושבת
 * למטה עליה עם גרדיאנט לקריאות. id="event-hero" הוא העוגן ש-
 * EventJourneyProgress משתמש בו כדי לדעת מתי המשתמש גלל מעבר ל-Hero.
 */
export function EventHero({ event, title }: { event: EventRecord; title: string }) {
  return (
    <div
      id="event-hero"
      className="relative -mx-4 flex min-h-[56vh] items-end overflow-hidden bg-navy sm:-mx-6 sm:min-h-[68vh]"
    >
      {event.cover_image_url ? <EventHeroBackground src={event.cover_image_url} /> : null}
      <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/45 to-transparent" />

      <div className="relative z-[1] mx-auto w-full max-w-4xl px-4 pb-10 pt-24 sm:px-6 sm:pb-14">
        {event.event_date_he || event.event_date ? (
          <p className="font-serif text-lead text-gold-bright">
            {event.event_date_he ?? <HebrewDate date={event.event_date} mode="hebrew" />}
          </p>
        ) : null}
        <h1 className="mt-3 text-[clamp(2rem,5vw,3.25rem)] leading-tight text-cream">{title}</h1>
        {event.event_date ? (
          <p className="mt-3 text-small text-cream/70">
            <HebrewDate date={event.event_date} mode="gregorian" />
          </p>
        ) : null}
      </div>
    </div>
  );
}
