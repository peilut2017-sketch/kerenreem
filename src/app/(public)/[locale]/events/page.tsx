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

  /* שלושה דליים, לא שניים:
     • קרובים — תאריך לועזי עתידי.
     • שנתיים — תאריך עברי קבוע בלי תאריך לועזי (ט״ו באב וכדומה): קודם
       לכן הם נפלו לנצח אל "שהיו", למרות שזה בדיוק המצב שהטופס בניהול
       מגדיר כ"אירוע שנתי חוזר".
     • שהיו — כל השאר. ההשוואה דרך Set של מזהים ולא includes על מערך —
       ‎O(n)‎ במקום ‎O(n²)‎ בארכיון של מאות אירועים. */
  const dated = events.filter((event) => parseDateOnly(event.event_date ?? '') !== null);
  const annual = events.filter((event) => !event.event_date && event.event_date_he);
  const upcoming = dated.filter((event) => isUpcoming(parseDateOnly(event.event_date ?? '')!));
  const upcomingIds = new Set(upcoming.map((event) => event.id));
  const annualIds = new Set(annual.map((event) => event.id));
  const past = events.filter((event) => !upcomingIds.has(event.id) && !annualIds.has(event.id));

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

      {annual.length > 0 ? (
        <section className="mb-16">
          <SectionHeading title={t('annual')} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {annual.map((event, index) => (
              <EventCard key={event.id} event={event} locale={locale} delay={index * 70} showExcerpt />
            ))}
          </ul>
        </section>
      ) : null}

      {past.length > 0 ? (
        <section>
          {/* הכותרת מוצגת תמיד — לא רק כשיש גם קרובים. בלעדיה, ברוב ימות
              השנה (אין אירוע עתידי) הארכיון הוצג בלי שום כותרת ונראה
              כאילו כל האירועים שבו עתידיים. */}
          <SectionHeading title={t('past')} />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                locale={locale}
                delay={index * 70}
                priority={upcoming.length === 0 && annual.length === 0 && index < 3}
                showExcerpt
              />
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  );
}
