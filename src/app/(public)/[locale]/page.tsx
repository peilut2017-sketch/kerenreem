import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Img as Image } from '@/components/Img';
import { HeroCarousel } from '@/components/hero/HeroCarousel';
import { BannerStrip } from '@/components/hero/BannerStrip';
import { BookShelf, type ShelfBook } from '@/components/home/BookShelf';
import { MostViewedRow } from '@/components/home/MostViewedRow';
import { HomeBackgroundDecor } from '@/components/home/HomeBackgroundDecor';
import type { HeroSlide } from '@/components/hero/types';
import { AboutBand } from '@/components/home/AboutBand';
import { EventsRow } from '@/components/home/EventsRow';
import { Ornament } from '@/components/Ornament';
import { Icon, hasIcon } from '@/components/Icon';
import { Reveal } from '@/components/Reveal';
import {
  getActivities,
  getBanners,
  getBooksByIds,
  getEvents,
  getMostViewedBooks,
  getPageBySlug,
  getRecentBooks,
  getSiteSettings,
} from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { getSpineLook } from '@/lib/cover-colors';
import { resolveBookAuthor } from '@/lib/books/author-display';

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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations();
  const [banners, books, activities, events, about, home, settings, flags, mostViewedBooks] = await Promise.all([
    getBanners(),
    getRecentBooks(10),
    getActivities(),
    getEvents(),
    getPageBySlug('about'),
    getPageBySlug('home'),
    getSiteSettings(),
    getCommerceFlags(),
    getMostViewedBooks(4),
  ]);

  // extra.extra יכול להיות null בפועל גם שהעמודה במסד not null default
  // '{}': שורה קיימת מלפני שהמפתחות האלה נכתבו לראשונה יכולה עדיין
  // להחזיק ערך null ישן. נפילה חזרה ל-{} כאן, פעם אחת, ולא ?. חוזר על
  // כל שימוש — גישה ישירה ל-extra.X בלי הבדיקה קורסת את כל העמוד.
  const extra = settings.extra ?? {};

  // false מפורש בלבד מכבה — היעדר המפתח (אתר שטרם נגע בהגדרה) ממשיך
  // להציג באנרים כברירת המחדל הקיימת, לא שובר התקנות ישנות.
  const bannersEnabled = extra.banners_enabled !== false;

  // בחירה קבועה למדף מהגדרות קטלוג וחנות (גרירה, ראו ShelfBooksPicker),
  // עם נפילה חזרה לכותרים האחרונים כשלא נבחרה רשימה.
  const shelfBookIds = Array.isArray(extra.shelf_book_ids)
    ? (extra.shelf_book_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  const curatedShelfBooks = shelfBookIds.length > 0 ? await getBooksByIds(shelfBookIds) : [];
  const shelfSourceBooks = curatedShelfBooks.length > 0 ? curatedShelfBooks : books.slice(0, 10);

  /* ------------------------------------------------------------------------
     גיבוי לראש העמוד כשאין באנרים: קרוסלה שנבנית מספר, אירוע וציר
     פעילות שפורסמו, כדי שהעמוד לא ייראה ריק לפני שהצוות העלה תמונות.
     התוכן אמיתי; אין פרוסות דמה ואין תמונות מלאי.
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

  /* ------------------------------------------------------------------------
     המדף: צבע השדרה נגזר מהכריכה בשרת, פעם אחת לכל בנייה מחדש (ISR,
     revalidate למעלה) ולא לכל מבקר. עשרה ספרים לכל היותר — זה מה שנכנס
     לרוחב מסך טלפון בלי גלישה, ראו BookShelf.tsx.
     ------------------------------------------------------------------------ */
  const shelfBooks: ShelfBook[] = await Promise.all(
    shelfSourceBooks.slice(0, 10).map(async (book) => {
      const title = localized(book, 'title', locale);
      const { base, edge } = book.spine_image_url
        ? { base: '', edge: '' } // שדרה שצולמה — הצבעים אינם בשימוש
        : await getSpineLook(book.cover_image_url);

      return {
        slug: book.slug,
        title,
        author: resolveBookAuthor(book, locale)?.name ?? null,
        coverUrl: book.cover_image_url,
        coverAlt: t('books.coverAlt', { title }),
        spineUrl: book.spine_image_url,
        spineBase: base,
        spineEdge: edge,
      };
    }),
  );

  // [1.11] רקע המדף נשלט מהגדרות האתר (ניהול ← הגדרות ← עמוד הבית);
  // בלי בחירה — צילום מן הפעילות או מאירוע, לא כריכת ספר: כריכה היא
  // טקסט, ומתוחה לרוחב המסך היא הופכת לרעש מאחורי המדף.
  const shelfBackdropUrl =
    (typeof extra.shelf_backdrop_url === 'string' && extra.shelf_backdrop_url) ||
    activities.find((activity) => activity.cover_image_url)?.cover_image_url ||
    events.find((event) => event.cover_image_url)?.cover_image_url ||
    null;

  // [1.11] תמונת מקטע "על המכון" — נשלטת גם היא מההגדרות, עם אותה נפילה
  // חזרה לתמונת ציר הפעילות המוביל שהייתה עד כה.
  const aboutImageUrl =
    (typeof extra.about_image_url === 'string' && extra.about_image_url) ||
    leadActivity?.cover_image_url ||
    null;

  return (
    <>
      {shelfBooks.length > 0 ? (
        /* רצועה כהה בגווני הלוגו (כחול עמוק + זהב), כמו יתר הרצועות
           הכהות בעמוד — כך שהמדף קורא כפינה משלו ולא כרשימה שיושבת על
           רקע העמוד הרגיל. לפני הבאנרים בכוונה: זה מה שהמבקר פוגש קודם. */
        <section className="on-dark relative isolate overflow-hidden py-16 lg:py-20">
          {shelfBackdropUrl ? (
            /* [1.13] בלי שכבת כהות מעל התמונה — התמונה שהועלתה בהגדרות
               מוצגת נקייה, בלי טשטוש/האפלה.
               [1.24] במובייל גובה הסעיף נגזר מהתוכן (כותרת + מדף + שורת
               "הנצפים ביותר") ומשתנה מאוד ולעיתים גבוה מאוד וצר — object-cover
               על קופסה כזו מותח/חותך תמונת-רוחב לפס דק כמעט ריק. לכן במובייל
               הרקע מוגבל לרצועה עליונה בגובה קבוע וסביר בלבד, לא לכל גובה
               הסעיף; מ-sm ומעלה הסעיף עצמו קצר ורחב דיו וחוזרים ל-inset מלא
               כמו קודם. הדהייה בתחתית הרצועה ממזגת אותה ברקע הכהה של הסעיף
               במקום קו חיתוך חד. */
            <div className="media-backdrop absolute inset-x-0 top-0 -z-20 h-[24rem] sm:inset-0 sm:h-auto">
              <Image src={shelfBackdropUrl} alt="" fill sizes="100vw" className="object-cover" />
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[var(--color-navy)] sm:hidden"
              />
            </div>
          ) : null}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(64rem_28rem_at_50%_-12%,color-mix(in_srgb,var(--color-gold)_22%,transparent),transparent_65%)]"
          />

          <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
            <header className="mb-10 text-center">
              {/* טקסט על גבי תמונה ללא שכבת כהות — צל טקסט שומר על קריאות
                  בלי להאפיל שוב על התמונה עצמה. */}
              <p className="eyebrow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                {t('home.newBooksLead')}
              </p>
              <h2
                className="mt-2 font-display text-[clamp(1.625rem,3.2vw,2.125rem)] text-white"
                style={{ textShadow: '0 2px 6px rgba(0,0,0,0.65)' }}
              >
                {t('home.newBooksTitle')}
              </h2>
            </header>
          </div>

          <BookShelf books={shelfBooks} label={t('home.shelfLabel')} />

          <div className="mx-auto mt-12 w-full max-w-[82rem] px-5 sm:px-8">
            <MostViewedRow books={mostViewedBooks} locale={locale} storeEnabled={flags.showPrices} />

            <p className="mt-10 text-center">
              <Link href="/books" className="link-more">
                {t('home.catalogueAll')}
              </Link>
            </p>
          </div>
        </section>
      ) : null}

      {bannersEnabled && banners.length > 0 ? (
        /* יש באנרים — הם התמונה עצמה, בלי כיתוב מונח מעליה */
        <BannerStrip banners={banners} locale={locale} label={t('hero.label')} />
      ) : bannersEnabled && slides.length > 0 ? (
        /* אין באנרים — הקרוסלה נבנית מתוכן שפורסם, ושם הכיתוב הכרחי:
           כריכת ספר בלי שם אינה אומרת דבר. כשהבאנרים כבויים בהגדרות
           במפורש, לא נופלים גם לקרוסלה הזו — כיבוי אומר "בלי קרוסלה
           בכלל", לא רק "בלי הבאנרים שהועלו". */
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

      {/* מרחב הרקע הבהיר של שלושת המקטעים הבאים משותף לשכבת הקישוט
          (HomeBackgroundDecor) — כדי שהעיגולים והספרים העדינים יזרמו
          ברצף מאחורי כולם, לא יתחילו מחדש בכל מקטע. */}
      <div className="relative isolate">
        <HomeBackgroundDecor />

        {aboutExcerpt ? <AboutBand excerpt={aboutExcerpt} imageUrl={aboutImageUrl} /> : null}

        {/* צירי הפעילות — רשימה ממוספרת. ארבעה צירים אינם ארבעה מוצרים,
            ולכן אין כאן כרטיסים עם אייקונים. */}
        {activities.length > 0 ? (
          <section className="py-16 lg:py-20">
            <div className="mx-auto w-full max-w-[82rem] px-5 sm:px-8">
              <header className="text-center">
                <p className="eyebrow">{t('home.activitiesLead')}</p>
                <h2 className="mt-2 font-display text-[clamp(1.625rem,3.2vw,2.125rem)] text-ink">
                  {t('home.activitiesTitle')}
                </h2>
                <Ornament />
              </header>

              {/* האייקון כאן נושא מידע: הוא מבדיל בין ארבעת הצירים במבט אחד.
                  כשלציר אין אייקון מוגדר, המספר הסידורי תופס את מקומו — כך
                  שהעמודה השמאלית נשארת יציבה ולא נוצר חור בפריסה. */}
              <ol className="mt-14 grid gap-6 sm:grid-cols-2">
                {activities.map((activity, index) => (
                  <Reveal as="li" key={activity.id} delay={index * 80}>
                    <Link
                      href={`/activities/${activity.slug}`}
                      className="card card-interactive group h-full flex-row gap-5 p-6 focus-visible:outline-offset-4"
                    >
                      <span
                        aria-hidden="true"
                        className="icon-chip h-14 w-14 shrink-0"
                      >
                        {hasIcon(activity.icon) ? (
                          <Icon name={activity.icon} className="h-6 w-6" />
                        ) : (
                          <span className="font-serif text-[1.125rem] tabular-nums">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        )}
                      </span>
                      <span className="block">
                        <span className="block font-serif text-h3 leading-snug text-ink transition-colors group-hover:text-burgundy">
                          {localized(activity, 'title', locale)}
                        </span>
                        <span className="mt-2.5 block max-w-[46ch] text-small leading-relaxed text-ink-soft">
                          {localized(activity, 'summary', locale)}
                        </span>
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ol>
            </div>
          </section>
        ) : null}

        <EventsRow events={events} locale={locale} />
      </div>
    </>
  );
}
