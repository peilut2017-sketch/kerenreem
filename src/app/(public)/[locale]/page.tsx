import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { SectionHeading } from '@/components/SectionHeading';
import { BookGrid } from '@/components/BookGrid';
import { HebrewDate } from '@/components/HebrewDate';
import { getActivities, getEvents, getPageBySlug, getRecentBooks } from '@/lib/data';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/sanitize';

export const revalidate = 3600;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const [books, activities, events, about, home] = await Promise.all([
    getRecentBooks(4),
    getActivities(),
    getEvents(),
    getPageBySlug('about'),
    getPageBySlug('home'),
  ]);

  const latestEvent = events[0] ?? null;
  const aboutExcerpt = htmlToPlainText(localized(about, 'body', locale), 320);

  // משפט הפתיחה נערך ב-CMS (עמוד בשם 'home'). הנוסח שבקוד הוא רשת ביטחון
  // בלבד, למקרה שהעמוד נמחק או שהמסד אינו זמין.
  const opening =
    htmlToPlainText(localized(home, 'body', locale), 240) ||
    'הפצת תורה ברבים — בהוצאה לאור של כתבי גדולי ישראל, בתמיכה בלומדיה ובמעשי חסד.';

  return (
    <>
      {/* ---------------------------------------------------------------
          פתיחה: משפט אחד על מה שהמכון עושה, ותאריך הייסוד בצד.
          לא באנר, לא תמונת רקע, לא שני כפתורי קריאה לפעולה.
          --------------------------------------------------------------- */}
      <Container as="section" className="border-b border-rule py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <p className="max-w-[34ch] font-serif text-[clamp(1.75rem,4.2vw,2.75rem)] leading-[1.25] text-ink">
            {opening}
          </p>
          <p className="text-small text-muted lg:text-end">{t('footer.founded')}</p>
        </div>
      </Container>

      {/* ---------------------------------------------------------------
          מן הקטלוג — הכריכות נושאות את העמוד.
          --------------------------------------------------------------- */}
      <Container as="section" className="py-16">
        <SectionHeading
          eyebrow={t('home.catalogueLead')}
          title={t('books.title')}
          action={{ href: '/books', label: t('home.catalogueAll') }}
        />
        {books.length > 0 ? (
          <BookGrid books={books} locale={locale} priorityCount={4} />
        ) : (
          <p className="max-w-[50ch] text-muted">{t('home.emptyCatalogue')}</p>
        )}
      </Container>

      {/* ---------------------------------------------------------------
          צירי הפעילות — רשימה ממוספרת, לא רשת כרטיסים עם אייקונים.
          המספור הוא הסימון הוויזואלי היחיד.
          --------------------------------------------------------------- */}
      {activities.length > 0 ? (
        <section className="border-y border-rule bg-paper-2 py-16">
          <Container>
            <SectionHeading eyebrow={t('home.activitiesLead')} title={t('activities.title')} />
            <ol className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
              {activities.map((activity, index) => (
                <li key={activity.id} className="flex gap-5">
                  <span
                    aria-hidden="true"
                    className="mt-1 shrink-0 font-serif text-[1.125rem] text-rule-strong tabular-nums"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="text-h3">
                      <Link href={`/activities/${activity.slug}`} className="text-ink hover:text-burgundy">
                        {localized(activity, 'title', locale)}
                      </Link>
                    </h3>
                    <p className="mt-2 max-w-[46ch] text-small leading-relaxed text-ink-soft">
                      {localized(activity, 'summary', locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------
          האירוע האחרון — התאריך העברי הוא הכותרת בפועל.
          --------------------------------------------------------------- */}
      {latestEvent ? (
        <Container as="section" className="py-16">
          <SectionHeading
            eyebrow={t('home.eventsLead')}
            title={t('events.title')}
            action={{ href: '/events', label: t('home.eventsAll') }}
          />
          <article className="grid gap-6 border-b border-rule pb-10 lg:grid-cols-[14rem_1fr] lg:gap-12">
            <p className="font-serif text-[1.125rem] leading-relaxed text-burgundy">
              {latestEvent.event_date_he ?? <HebrewDate date={latestEvent.event_date} mode="hebrew" />}
            </p>
            <div>
              <h3 className="text-h2">
                <Link href={`/events/${latestEvent.slug}`} className="text-ink hover:text-burgundy">
                  {localized(latestEvent, 'title', locale)}
                </Link>
              </h3>
              {latestEvent.event_date ? (
                <p className="mt-2 text-small text-muted">
                  <HebrewDate date={latestEvent.event_date} mode="gregorian" />
                </p>
              ) : null}
              <p className="mt-4 max-w-[58ch] text-ink-soft">
                {htmlToPlainText(localized(latestEvent, 'body', locale), 260)}
              </p>
            </div>
          </article>
        </Container>
      ) : null}

      {/* ---------------------------------------------------------------
          על המכון — טור קריאה צר, סוגר את העמוד בשקט.
          --------------------------------------------------------------- */}
      {aboutExcerpt ? (
        <Container as="section" width="text" className="py-16">
          <p className="eyebrow mb-3">{t('home.aboutLead')}</p>
          <p className="text-lead leading-relaxed text-ink-soft">{aboutExcerpt}</p>
          <p className="mt-6">
            <Link href="/about" className="link text-small">
              {t('home.aboutMore')}
            </Link>
          </p>
        </Container>
      ) : null}
    </>
  );
}
