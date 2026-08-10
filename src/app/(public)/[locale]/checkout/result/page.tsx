import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { ResultClient } from '@/components/store/checkout/ResultClient';

/**
 * עמוד התוצאה (פרק 7.5, תרשים 19): ההפניה חזרה מדף הסליקה אינה אישור —
 * המצב נקרא מהשרת (לפי ה-session) ומתעדכן עד שה-Webhook מגיע. "מעבדים
 * את התשלום" הוא מצב ביניים חיובי, לא שגיאה.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('checkoutTitle'), robots: { index: false } };
}

export default async function CheckoutResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ outcome?: string }>;
}) {
  const { locale } = await params;
  const { outcome } = await searchParams;
  setRequestLocale(locale);

  return (
    <Container className="commerce-flow py-16 lg:py-24">
      <ResultClient outcome={outcome ?? 'unknown'} />
    </Container>
  );
}
