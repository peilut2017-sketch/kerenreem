import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { OrderFinderForm } from '@/components/store/OrderFinderForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('findOrderTitle'), robots: { index: false, follow: false } };
}

/**
 * [1.6] "מצא את ההזמנה שלי" (ט.19, ביקורת ב.24: "אין מסך 'הזנת מספר
 * הזמנה + טלפון'") — ליד למי שאיבד את קישור המעקב שבמייל.
 */
export default async function FindOrderPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  return (
    <Container className="max-w-md py-16 lg:py-24">
      <h1 className="text-center font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
        {t('findOrderTitle')}
      </h1>
      <p className="mt-3 text-center text-lead text-muted">{t('findOrderIntro')}</p>
      <OrderFinderForm />
    </Container>
  );
}
