import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { HeroCarousel } from '@/components/hero/HeroCarousel';
import type { HeroSlide } from '@/components/hero/types';
import { AboutBand } from '@/components/home/AboutBand';
import { FeaturedBooks } from '@/components/home/FeaturedBooks';
import { EventsRow } from '@/components/home/EventsRow';
import { ContactBand } from '@/components/home/ContactBand';
import { Ornament } from '@/components/Ornament';
import { Reveal } from '@/components/Reveal';
import {
  getActivities,
  getEvents,
  getPageBySlug,
  getRecentBooks,
  getSiteSettings,
} from '@/lib/data';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/sanitize';

export const revalidate = 3600;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const [books, activities, events, about, home, settings] = await Promise.all([
    getRecentBooks(5),
    getActivities(),
    getEvents(),
    getPageBySlug('about'),
    getPageBySlug('home'),
    getSiteSettings(),
  ]);

  /* ------------------------------------------------------------------------
     הקרוסלה נבנית מתוכן אמיתי בלבד — ספר, אירוע וציר פעילות. אין תמונות
     מלאי ואין פרוסות דמה: אם אין תוכן מתאים, הפרוסה פשוט לא נוצרת.
     ------------------------------------------------------------------------ */
  const slides: HeroSlide[] = [];

  const leadBook = books.find((book) => book.cover_image_url) ?? books[0];
  if (leadBook) {
    const title = localized(leadBook, 'title', locale);
    slides.push({
      id: `book-${leadBook.id}`,
      kind: 'book',
      eyebrow: t('hero.bookEyebrow'),
      title,
      summary:
        localizedOrNull(leadBook, 'subtitle', locale) ??
        htmlToPlainText(localized(leadBook, 'description', locale), 140),
      href: `/books/${leadBook.slug}`,
      ctaLabel: t('hero.bookCta'),
      imageUrl: leadBook.cover_image_url,
      imageAlt: t('books.coverAlt', { title }),
    });
  }

  const leadEvent = events.find((event) => event.cover_image_url) ?? events[0];
  if (leadEvent) {
    slides.push({
      id: `event-${leadEvent.id}`,
      kind: 'event',
      eyebrow: t('hero.eventEyebrow'),
      title: localized(leadEvent, 'title', locale),
      summary:
        leadEvent.event_date_he ?? htmlToPlainText(localized(leadEvent, 'body', locale), 140),
      href: `/events/${leadEvent.slug}`,
      ctaLabel: t('hero.eventCta'),
      imageUrl: leadEvent.cover_image_url,
      imageAlt: '',
    });
  }

  const leadActivity = activities.find((activity) => activity.cover_image_url) ?? activities[0];
  if (leadActivity) {
    slides.push({
      id: `activity-${leadActivity.id}`,
      kind: 'activity',
      eyebrow: t('hero.activityEyebrow'),
      title: localized(leadActivity, 'title', locale),
      summary: localizedOrNull(leadActivity, 'summary', locale),
      href: `/activities/${leadActivity.slug}`,
      ctaLabel: t('hero.activityCta'),
      imageUrl: leadActivity.cover_image_url,
      imageAlt: '',
    });
  }

  const opening =
    htmlToPlainText(localized(home, 'body', locale), 200) ||
    'הפצת תורה ברבים — בהוצאה לאור של כתבי גדולי ישראל, בתמיכה בלומדיה ובמעשי חסד.';

  const aboutExcerpt = htmlToPlainText(localized(about, 'body', locale), 330);

  return (
    <>
      {slides.length > 0 ? (
        <HeroCarousel slides={slides} />
      ) : (
        /* בלי תוכן מפורסם אין מה לסובב. במקום קרוסלה ריקה — הצהרה
           טיפוגרפית שעומדת בפני עצמה. */
        <section className="on-dark px-6 py-24 text-center lg:py-32">
          <p className="eyebrow">{t('site.tagline')}</p>
          <h1 className="mx-auto mt-4 max-w-[22ch] font-serif text-[clamp(1.875rem,5vw,3rem)] leading-[1.2] text-white">
            {opening}
          </h1>
          <Ornament />
        </section>
      )}

      {aboutExcerpt ? (
        <AboutBand excerpt={aboutExcerpt} imageUrl={leadActivity?.cover_image_url ?? null} />
      ) : null}

      <FeaturedBooks books={books} locale={locale} />

      {/* צירי הפעילות — רשימה ממוספרת. ארבעה צירים אינם ארבעה מוצרים,
          ולכן אין כאן כרטיסים עם אייקונים. */}
      {activities.length > 0 ? (
        <section className="border-y border-rule bg-cream py-20 lg:py-24">
          <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
            <header className="text-center">
              <p className="eyebrow">{t('home.activitiesLead')}</p>
              <h2 className="mt-2 font-serif text-[clamp(1.625rem,3.2vw,2.125rem)] text-ink">
                {t('home.activitiesTitle')}
              </h2>
              <Ornament />
            </header>

            <ol className="mt-14 grid gap-x-14 gap-y-11 sm:grid-cols-2">
              {activities.map((activity, index) => (
                <Reveal as="li" key={activity.id} delay={index * 80}>
                  <article className="flex gap-5 border-t border-rule pt-6">
                    <span
                      aria-hidden="true"
                      className="shrink-0 font-serif text-[1.375rem] leading-none tabular-nums text-gold-deep"
                    >
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-serif text-h3 leading-snug">
                        <Link
                          href={`/activities/${activity.slug}`}
                          className="text-ink transition-colors hover:text-burgundy"
                        >
                          {localized(activity, 'title', locale)}
                        </Link>
                      </h3>
                      <p className="mt-2.5 max-w-[48ch] text-small leading-relaxed text-ink-soft">
                        {localized(activity, 'summary', locale)}
                      </p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>
      ) : null}

      <EventsRow events={events} locale={locale} />

      {/* רקע הרצועה הוא צילום מן הפעילות או מאירוע — לא כריכת ספר.
          כריכה היא טקסט, ומתוחה לרוחב המסך היא הופכת לרעש מאחורי הטופס. */}
      <ContactBand
        contact={settings.contact ?? {}}
        backdropUrl={
          activities.find((activity) => activity.cover_image_url)?.cover_image_url ??
          events.find((event) => event.cover_image_url)?.cover_image_url ??
          null
        }
        locale={locale}
      />
    </>
  );
}
