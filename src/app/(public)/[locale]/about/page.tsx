import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContentPageView } from '@/components/ContentPageView';
import { pageAlternates } from '@/lib/seo';
import { htmlToPlainText } from '@/lib/html-text';
import { localized } from '@/lib/localized';
import { getPageBySlug } from '@/lib/data';

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
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'pages' }),
    getPageBySlug('about'),
  ]);
  // תיאור מגוף העמוד (כמו בעמוד הספר) — בלעדיו העמוד ירש את סלוגן האתר
  const description = page ? htmlToPlainText(localized(page, 'body', locale), 160) : '';
  return {
    title: t('about'),
    description: description || undefined,
    alternates: pageAlternates(locale, '/about'),
  };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('pages');

  return <ContentPageView slug="about" fallbackTitle={t('about')} showUpdated={false} />;
}
