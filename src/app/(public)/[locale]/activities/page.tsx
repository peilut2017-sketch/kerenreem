import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { getActivities } from '@/lib/data';
import { localized } from '@/lib/localized';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'activities' });
  return { title: t('title'), description: t('intro') };
}

export default async function ActivitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('activities');
  const activities = await getActivities();

  return (
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="mt-14" />

      {activities.length === 0 ? (
        <p className="text-muted">{t('empty')}</p>
      ) : (
        /* רשימה ממוספרת ולא כרטיסים: ארבעה צירים אינם ארבעה מוצרים. */
        <ol className="border-t border-rule">
          {activities.map((activity, index) => (
            <li key={activity.id} className="border-b border-rule py-8">
              <div className="grid gap-4 sm:grid-cols-[3rem_1fr] sm:gap-8">
                <span
                  aria-hidden="true"
                  className="font-serif text-[1.25rem] tabular-nums text-gold-deep"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h2 className="text-h2">
                    <Link href={`/activities/${activity.slug}`} className="text-ink hover:text-burgundy">
                      {localized(activity, 'title', locale)}
                    </Link>
                  </h2>
                  <p className="mt-3 max-w-[60ch] text-ink-soft">
                    {localized(activity, 'summary', locale)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Container>
  );
}
