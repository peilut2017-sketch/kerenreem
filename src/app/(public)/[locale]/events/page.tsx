import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { SectionHeading } from '@/components/SectionHeading';
import { EventCard } from '@/components/events/EventCard';
import { getEvents } from '@/lib/data';
import { isUpcoming, parseDateOnly } from '@/lib/hebrew-date';
import { pageAlternates } from '@/lib/seo';

/*
 * ‏[1.42] העמוד הזה **כן** תלוי בזמן, ולכן נשאר לו חלון — אבל של שעה
 * ולא של דקה.
 *
 * הסיבה: הרשימה מפוצלת ל"אירועים קרובים" ול"אירועים שהיו", והפיצול
 * נעשה כאן בזמן הרינדור מול *היום* (‎isUpcoming, שורה 43 למטה). אירוע
 * שמתקיים היום עובר ל"היו" בחצות — בלי ששום שורה במסד משתנה, ולכן בלי
 * שום ‎mutation שיפעיל ‎revalidatePath. עמוד סטטי לחלוטין היה מציג אירוע
 * שעבר כ"קרוב" עד לשמירה הבאה בניהול.
 *
 * הגבול יומי, ולכן רזולוציה של דקה הייתה מיותרת פי 60: שעה מספיקה
 * כדי שהמעבר ייראה נכון, ומצמצמת את הכתיבות בהתאם.
 *
 * העמוד הזה מועמד לטיפול ב-cron הגבולות (מבצעים/באנרים/תאריכי אירועים),
 * וברגע שיהיה — גם החלון הזה יוכל לצאת.
 */
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'events' });
  return { title: t('title'), description: t('intro'), alternates: pageAlternates(locale, '/events') };
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
  const upcomingIds = new Set(upcoming.map((event) => event.id));
  const past = events.filter((event) => !upcomingIds.has(event.id));

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
