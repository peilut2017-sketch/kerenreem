import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeading } from '@/components/SectionHeading';
import { EventCard } from '@/components/events/EventCard';
import { getEvents } from '@/lib/data';
import { isUpcoming, parseDateOnly } from '@/lib/hebrew-date';

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
        <section className="mb-16">
          <SectionHeading title={t('upcoming')} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming
              .slice()
              .reverse()
              .map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  locale={locale}
                  delay={index * 70}
                  priority={index < 3}
                  showExcerpt
                />
              ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          {upcoming.length > 0 ? <SectionHeading title={t('past')} /> : null}
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
                delay={index * 70}
                priority={upcoming.length === 0 && index < 3}
                showExcerpt
              />
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
