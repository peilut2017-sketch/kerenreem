import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { RichText } from '@/components/RichText';
import { getActivityBySlug, getActivitySlugs } from '@/lib/data';
import { localized, localizedOrNull } from '@/lib/localized';
import { htmlToPlainText } from '@/lib/html-text';
import { routing } from '@/i18n/routing';

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getActivitySlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const activity = await getActivityBySlug(slug);
  if (!activity) return {};

  const title = localized(activity, 'title', locale);
  return {
    title,
    description:
      localizedOrNull(activity, 'summary', locale) ??
      htmlToPlainText(localized(activity, 'body', locale), 160),
  };
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const activity = await getActivityBySlug(slug);
  if (!activity) notFound();

  const title = localized(activity, 'title', locale);
  const summary = localizedOrNull(activity, 'summary', locale);

  return (
    <article>
      <Container width="text" className="py-14">
        <h1 className="text-h1 text-ink">{title}</h1>
        {summary ? <p className="mt-4 text-lead leading-relaxed text-muted">{summary}</p> : null}
      </Container>

      {activity.cover_image_url ? (
        <Container className="mb-12">
          <Image
            src={activity.cover_image_url}
            alt=""
            width={1440}
            height={720}
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="h-auto w-full border border-rule object-cover"
            priority
          />
        </Container>
      ) : null}

      <Container width="text" className="pb-16">
        <RichText html={localized(activity, 'body', locale)} />
      </Container>
    </article>
  );
}
