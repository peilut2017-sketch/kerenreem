import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { RichText } from '@/components/RichText';
import { SectionHeading } from '@/components/SectionHeading';
import { VideoEmbed } from '@/components/VideoEmbed';
import { EventHero } from '@/components/events/EventHero';
import { EventJourneyProgress } from '@/components/events/EventJourneyProgress';
import { EventLightboxProvider } from '@/components/events/EventLightbox';
import { EventBlockList } from '@/components/events/EventBlockList';
import { EventStoryGallery } from '@/components/events/EventStoryGallery';
import { getEventBySlug, getEventSlugs, getOtherEventWithMedia } from '@/lib/data';
import { buildEventGalleryIndex, extractEventStages, legacyGalleryToMedia } from '@/lib/event-gallery';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';
import { pageAlternates } from '@/lib/seo';
import { toCdnUrl } from '@/lib/image-src';

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
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getEventSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug: rawSlug } = await params;
  // [1.9] כתובת בעברית מגיעה מ-Next כאן עדיין percent-encoded — בלי
  // הפענוח ההשוואה למזהה השמור במסד (עברית רגילה) לעולם לא תואמת.
  const slug = decodeURIComponent(rawSlug);
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const title = localized(event, 'title', locale);
  return {
    title,
    description: htmlToPlainText(localized(event, 'body', locale), 160) || title,
    alternates: pageAlternates(locale, `/events/${event.slug}`),
    openGraph: {
      title,
      type: 'article',
      images: event.cover_image_url ? [{ url: toCdnUrl(event.cover_image_url), alt: title }] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug: rawSlug } = await params;
  setRequestLocale(locale);
  const slug = decodeURIComponent(rawSlug);

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations('events');
  const title = localized(event, 'title', locale);
  const blocks = event.blocks ?? [];

  const gallery = buildEventGalleryIndex(event);
  const { labels: stages, blockStageIndex } = extractEventStages(blocks);
  // [1.14] מדיה מהטבלה החדשה (event_media) קודמת; אירוע שעדיין לא
  // הועברה לו מדיה מוצג דרך אותו רכיב בדיוק, עם הגלריה הישנה (jsonb)
  // מותאמת לאותה צורה — כך "הגלריה הישנה" (הרשת/הפס הנפרדים) הוסרה
  // כליל, ואין עוד שני מסלולי תצוגה.
  const storyMedia = event.media?.length ? event.media : legacyGalleryToMedia(event.id, event.gallery ?? []);
  // [1.14] הצעת "מעבר לגלריה אחרת" בסיום דפדוף ה-Reels — נטען רק כשיש
  // בכלל מה להציע (מדיה קיימת), לא סתם על כל טעינת עמוד.
  const suggestedEvent = storyMedia.length > 0 ? await getOtherEventWithMedia(event.id, slug) : null;

  return (
    <article>
      <EventHero event={event} title={title} />
      <EventJourneyProgress stages={stages} />

      <EventLightboxProvider images={gallery.images}>
        {event.body_he || event.body_en ? (
          <Container width="text" className="pt-12">
            <RichText html={localized(event, 'body', locale)} />
          </Container>
        ) : null}

        {event.featured_video_url ? (
          <Container className="mt-10">
            <VideoEmbed url={event.featured_video_url} title={`${t('videoTitle')} — ${title}`} />
          </Container>
        ) : null}

        {blocks.length > 0 ? (
          <Container width="text" className="py-14">
            <EventBlockList
              blocks={blocks}
              gallery={gallery}
              eventTitle={title}
              blockStageIndex={blockStageIndex}
              locale={locale}
            />
          </Container>
        ) : null}

        {/* [1.14] Event Story Gallery — מסלול התצוגה היחיד לגלריית האירוע:
            פריסה עריכתית עם שלבים במחשב, חוויית דפדוף (Reels) במובייל,
            ו-Viewer מלא עם deep-link. גם אירוע שטרם הועברה לו מדיה
            לטבלה החדשה מוצג דרך אותו רכיב (ראו legacyGalleryToMedia). */}
        {storyMedia.length > 0 ? (
          <Container className="pb-16 pt-6">
            <SectionHeading title={t('gallery')} />
            <div className="mt-6">
              <EventStoryGallery
                media={storyMedia}
                chapters={event.chapters ?? []}
                locale={locale}
                suggestedEvent={suggestedEvent}
              />
            </div>
          </Container>
        ) : null}
      </EventLightboxProvider>
    </article>
  );
}
