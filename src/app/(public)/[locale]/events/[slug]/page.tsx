import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { HebrewDate } from '@/components/HebrewDate';
import { RichText } from '@/components/RichText';
import { SectionHeading } from '@/components/SectionHeading';
import { VideoEmbed } from '@/components/VideoEmbed';
import { getEventBySlug, getEventSlugs } from '@/lib/data';
import { localized } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;
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
  const gallery = Array.isArray(event.gallery) ? event.gallery : [];

  return (
    <article>
      <Container width="text" className="pt-14">
        <p className="font-serif text-lead text-burgundy">
          {event.event_date_he ?? <HebrewDate date={event.event_date} mode="hebrew" />}
        </p>
        <h1 className="mt-3 text-h1 text-ink">{title}</h1>
        {event.event_date ? (
          <p className="mt-3 text-small text-muted">
            <HebrewDate date={event.event_date} mode="gregorian" />
          </p>
        ) : null}
      </Container>

      {event.cover_image_url ? (
        <Container className="mt-10">
          <Image
            src={event.cover_image_url}
            alt=""
            width={1440}
            height={810}
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="h-auto w-full border border-rule"
            priority
          />
        </Container>
      ) : null}

      {event.featured_video_url ? (
        <Container className="mt-10">
          <VideoEmbed url={event.featured_video_url} title={`${t('videoTitle')} — ${title}`} />
        </Container>
      ) : null}

      <Container width="text" className="py-14">
        <RichText html={localized(event, 'body', locale)} />
      </Container>

      {gallery.length > 0 ? (
        <Container className="pb-16">
          <SectionHeading title={t('gallery')} />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {gallery.map((image, index) => {
              const caption = locale === 'en' ? image.caption_en || image.caption_he : image.caption_he;
              return (
                <li key={`${image.url}-${index}`}>
                  <figure>
                    <Image
                      src={image.url}
                      alt={caption || t('galleryImageAlt', { index: index + 1 })}
                      width={640}
                      height={480}
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="h-auto w-full border border-rule object-cover"
                    />
                    {caption ? (
                      <figcaption className="mt-2 text-caption text-muted">{caption}</figcaption>
                    ) : null}
                  </figure>
                </li>
              );
            })}
          </ul>
        </Container>
      ) : null}
    </article>
  );
}
