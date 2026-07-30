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
import { MemoryStrip } from '@/components/events/MemoryStrip';
import { EventClosingGallery } from '@/components/events/EventClosingGallery';
import { getEventBySlug, getEventSlugs } from '@/lib/data';
import { buildEventGalleryIndex, extractEventStages } from '@/lib/event-gallery';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';

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
  const { locale, slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const title = localized(event, 'title', locale);
  return {
    title,
    description: htmlToPlainText(localized(event, 'body', locale), 160) || title,
    openGraph: {
      title,
      type: 'article',
      images: event.cover_image_url ? [{ url: event.cover_image_url, alt: title }] : undefined,
    },
  };
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const t = await getTranslations('events');
  const title = localized(event, 'title', locale);
  const blocks = event.blocks ?? [];

  const gallery = buildEventGalleryIndex(event);
  const { labels: stages, blockStageIndex } = extractEventStages(blocks);

  // דגימה קטנה מהגלריה המסיימת לפס הזיכרונות — לא כל הגלריה, רק טעימה
  const memoryImages = gallery.images.slice(gallery.closingGalleryStart, gallery.closingGalleryStart + 8);

  return (
    <article>
      <EventHero event={event} title={title} />
      <EventJourneyProgress stages={stages} heroId="event-hero" />

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
            />
          </Container>
        ) : null}

        {memoryImages.length > 0 && blocks.length > 0 ? (
          <Container className="pb-6">
            <MemoryStrip images={memoryImages} />
          </Container>
        ) : null}

        {gallery.images.length > gallery.closingGalleryStart ? (
          <Container className="pb-16 pt-6">
            <SectionHeading title={t('gallery')} />
            <div className="mt-6">
              <EventClosingGallery
                images={gallery.images.slice(gallery.closingGalleryStart)}
                startIndex={gallery.closingGalleryStart}
              />
            </div>
          </Container>
        ) : null}
      </EventLightboxProvider>
    </article>
  );
}
