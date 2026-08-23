import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { Icon, hasIcon } from '@/components/Icon';
import { getActivities } from '@/lib/data';
import { localized } from '@/lib/localized';

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
        /* הכרטיס כולו הוא הקישור — באותו דפוס כמו כרטיסי הצירים בעמוד
           הבית וכרטיסי הספרים: קודם לכן רק שורת הכותרת הייתה לחיצה,
           והכרטיס — בלי hover ובלי חץ — לא נראה לחיץ בכלל. ul ולא ol:
           הסדר אינו נושא משמעות (המספר מוצג רק כשאין אייקון). */
        <ul className="grid gap-6 sm:grid-cols-2">
          {activities.map((activity, index) => (
            <li key={activity.id}>
              <Link
                href={`/activities/${activity.slug}`}
                className="card card-interactive group flex h-full flex-row gap-5 p-7 focus-visible:outline-offset-4"
              >
                <span aria-hidden="true" className="icon-chip h-14 w-14 shrink-0">
                  {hasIcon(activity.icon) ? (
                    <Icon name={activity.icon} className="h-6 w-6" />
                  ) : (
                    <span className="font-serif text-[1.125rem] tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  )}
                </span>
                <span className="block">
                  {/* text-h3 ולא text-h2: כותרת בגודל כותרת-מקטע בתוך כרטיס
                      משני שברה את המדרג מול ה-PageHeader שמעל */}
                  <span className="block font-serif text-h3 leading-snug text-ink transition-colors group-hover:text-burgundy">
                    {localized(activity, 'title', locale)}
                  </span>
                  <span className="mt-3 block max-w-[60ch] text-small leading-relaxed text-ink-soft">
                    {localized(activity, 'summary', locale)}
                  </span>
                  <span className="link-more mt-4">{t('readMore')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
