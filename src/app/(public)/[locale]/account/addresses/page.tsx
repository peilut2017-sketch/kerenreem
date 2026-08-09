import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { Link } from '@/i18n/navigation';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { getCustomerSession, getMyAddresses } from '@/lib/commerce/account';
import { AddressBook } from '@/components/store/account/AddressBook';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('addressesTitle'), robots: { index: false } };
}

/** [1.3] "הכתובות שלי" (פרק 4.6) — ניהול פנקס הכתובות של הלקוח. */
export default async function AddressesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const flags = await getCommerceFlags();
  const t = await getTranslations('store');
  if (!flags.accountsEnabled) {
    return (
      <Container className="py-20 text-center">
        <p className="text-lead text-muted">{t('disabled')}</p>
      </Container>
    );
  }

  const session = await getCustomerSession();
  if (!session) redirect('/account/login');

  const addresses = await getMyAddresses();

  return (
    <Container className="max-w-3xl py-12 lg:py-16">
      <nav className="text-caption text-muted">
        <Link href="/account" className="underline-offset-2 hover:text-burgundy hover:underline">
          {t('accountBackToAccount')}
        </Link>
      </nav>
      <header className="mt-4">
        <p className="eyebrow">{t('accountTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('addressesTitle')}
        </h1>
        <p className="mt-2 text-small text-muted">{t('addressesIntro')}</p>
      </header>
      <div className="mt-8">
        <AddressBook addresses={addresses} />
      </div>
    </Container>
  );
}
