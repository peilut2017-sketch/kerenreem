import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { Icon, hasIcon } from '@/components/Icon';
import { getActivities } from '@/lib/data';
import { localized } from '@/lib/localized';
import { pageAlternates } from '@/lib/seo';

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
  const t = await getTranslations({ locale, namespace: 'activities' });
  return { title: t('title'), description: t('intro'), alternates: pageAlternates(locale, '/activities') };
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
        <ol className="grid gap-6 sm:grid-cols-2">
          {activities.map((activity, index) => (
            <li key={activity.id} className="card p-7">
              <div className="flex gap-5">
                <span
                  aria-hidden="true"
                  className="icon-chip h-14 w-14"
                >
                  {hasIcon(activity.icon) ? (
                    <Icon name={activity.icon} className="h-6 w-6" />
                  ) : (
                    <span className="font-serif text-[1.125rem] tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  )}
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
