import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPageView } from '@/components/ContentPageView';
import { pageAlternates } from '@/lib/seo';
import { htmlToPlainText } from '@/lib/html-text';
import { localized } from '@/lib/localized';
import { getPageBySlug } from '@/lib/data';

/*
 * ‏[1.42] סטטי, בלי revalidate מבוסס-זמן.
 *
 * עד כה עמד כאן ‎revalidate = 60 — לא מטעמי תעבורה אלא מחשש
 * ש-revalidatePath אינו פועל בפועל. התוצאה הייתה שהעמוד נרנדר ונכתב
 * למטמון מחדש בכל דקה שבה הגיעה אליו בקשה, לנצח, גם כשלא השתנה בו דבר
 * — וזה רוב הזמן: זה עמוד שנערך פעם בשנה.
 *
 * אין בעמוד הזה שום תלות בזמן: אין חלון תאריכים, אין מחיר, אין מלאי.
 * כל שינוי אמיתי בו מגיע משמירה בניהול, ושמירה כזו כבר מרעננת אותו
 * ‏on-demand (ראו entity.revalidate ב-lib/admin/schema.ts). אם רענון
 * יזום אינו מגיע — יש לכך כפתור מפורש בניהול (revalidateAllPublicPages),
 * ולא חלון של דקה שמשלם על החשש הזה בכל בקשה.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'pages' }),
    getPageBySlug('privacy'),
  ]);
  // תיאור מגוף העמוד (כמו בעמוד הספר) — בלעדיו העמוד ירש את סלוגן האתר
  const description = page ? htmlToPlainText(localized(page, 'body', locale), 160) : '';
  return {
    title: t('privacy'),
    description: description || undefined,
    alternates: pageAlternates(locale, '/privacy'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages');

  return <ContentPageView slug="privacy" fallbackTitle={t('privacy')} showUpdated={true} />;
}
