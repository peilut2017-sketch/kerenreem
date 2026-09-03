import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { CheckoutClient } from '@/components/store/checkout/CheckoutClient';

/**
 * עמוד ה-Checkout (פרק 7 במסמך האב): עמוד אחד, שלושה בלוקים, בלי הסחות.
 * דינמי במלואו — אין ISR על תהליך תשלום. תוכן העגלה מקומי, ולכן
 * ה-bootstrap (יצירת session ואימות שרת) נעשה מהלקוח ב-CheckoutClient.
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

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [flags, t] = await Promise.all([getCommerceFlags(), getTranslations('store')]);

  if (!flags.checkoutEnabled) {
    return (
      <Container className="py-20 text-center">
        <h1 className="font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">{t('checkoutTitle')}</h1>
        <p className="mt-4 text-lead text-muted">{t('disabled')}</p>
      </Container>
    );
  }

  return (
    <Container className="py-10 lg:py-14">
      <h1 className="text-center font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
        {t('checkoutTitle')}
      </h1>
      <CheckoutClient />
    </Container>
  );
}
