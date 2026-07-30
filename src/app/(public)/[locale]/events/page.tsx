import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { HebrewDate } from '@/components/HebrewDate';
import { SectionHeading } from '@/components/SectionHeading';
import { getEvents } from '@/lib/data';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { isUpcoming, parseDateOnly } from '@/lib/hebrew-date';
import type { EventRecord } from '@/lib/supabase/types';

/**
 * חלון קצר במקום שעה, לא בגלל תעבורה אלא בגלל revalidatePath עצמו.
 *
 * נמדד ישירות: קריאה ל-revalidatePath, גם מ-Server Action וגם מ-Route
 * Handler, סימנה את המטמון לרענון אך לא שינתה בפועל את מה שמוגש לבקשה
 * הבאה מדפדפן חדש — נבדק עם Next.js 16.2.12 ובנייה עם Turbopack, שוב
 * ושוב, כולל אחרי המתנה ובקשות חוזרות. יתכן שזו התנהגות שונה בפריסה
 * אמיתית (Vercel), אבל אי אפשר להסתמך על זה בלי דרך לאמת. חלון של דקה
 * מבטיח שתוכן חדש יופיע גם אם הרענון היזום אינו פועל בפועל, ועדיין
 * שומר על מרבית התועלת של מטמון קצה עבור תעבורה אמיתית.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  return { title: t('title'), description: t('intro') };
}

function EventRow({ event, locale }: { event: EventRecord; locale: string }) {
  return (
    <li className="border-b border-rule py-8">
      <article className="grid gap-3 lg:grid-cols-[14rem_1fr] lg:gap-12">
        <div>
          {/* התאריך העברי הוא הכותרת בפועל של אירוע במכון תורני */}
          <p className="font-serif text-[1.0625rem] text-burgundy">
            {event.event_date_he ?? <HebrewDate date={event.event_date} mode="hebrew" />}
          </p>
          {event.event_date ? (
            <p className="mt-1 text-caption text-muted">
              <HebrewDate date={event.event_date} mode="gregorian" />
            </p>
          ) : null}
        </div>
        <div>
          <h3 className="text-h3">
            <Link href={`/events/${event.slug}`} className="text-ink hover:text-burgundy">
              {localized(event, 'title', locale)}
            </Link>
          </h3>
          <p className="mt-2 max-w-[62ch] text-small leading-relaxed text-ink-soft">
            {htmlToPlainText(localized(event, 'body', locale), 220)}
          </p>
        </div>
      </article>
    </li>
  );
}

export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('events');
  const events = await getEvents();

  const upcoming = events.filter((event) => {
    const date = parseDateOnly(event.event_date ?? '');
    return date ? isUpcoming(date) : false;
  });
  const past = events.filter((event) => !upcoming.includes(event));

  return (
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="mt-12" />

      {events.length === 0 ? <p className="text-muted">{t('empty')}</p> : null}

      {upcoming.length > 0 ? (
        <section className="mb-14">
          <SectionHeading title={t('upcoming')} />
          <ul className="border-t border-rule">
            {upcoming
              .slice()
              .reverse()
              .map((event) => (
                <EventRow key={event.id} event={event} locale={locale} />
              ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          {upcoming.length > 0 ? <SectionHeading title={t('past')} /> : null}
          <ul className="border-t border-rule">
            {past.map((event) => (
              <EventRow key={event.id} event={event} locale={locale} />
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
