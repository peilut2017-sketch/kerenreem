import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { CartPageClient } from '@/components/store/CartPageClient';

/**
 * עמוד העגלה (פרק 6.4): שקיפות מלאה — סכום ביניים, משלוח משוער, פס
 * משלוח חינם, תאריך אספקה משוער וסכום כולל משוער. התוכן עצמו חי בצד
 * הלקוח (העגלה מקומית); העמוד רק נותן מסגרת ותרגומים.
 */

/*
 * ‏[1.42] סטטי. אין בעמוד הזה שום נתון מהשרת: העגלה חיה בדפדפן, וכל
 * המחירים, הזמינות והסכומים נשלפים מהמסד דרך Server Action בזמן אמת
 * ‏(getCartView → validateCart). ‏revalidate = 60 היה כותב מחדש מעטפת
 * טקסט שאינה משתנה כלל.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('cart'), robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  return (
    <Container className="py-12 lg:py-16">
      <PageHeader title={t('cart')} />
      <CartPageClient />
    </Container>
  );
}
