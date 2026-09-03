import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { getCustomerSession } from '@/lib/commerce/account';
import { LoginClient } from '@/components/store/account/LoginClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('accountLoginTitle'), robots: { index: false } };
}

export default async function AccountLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ issue?: string }>;
}) {
  const { locale } = await params;
  const { issue } = await searchParams;
  setRequestLocale(locale);

  const flags = await getCommerceFlags();
  const t = await getTranslations('store');
  if (!flags.accountsEnabled) {
    return (
      <Container className="py-20 text-center">
        <h1 className="font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">{t('accountLoginTitle')}</h1>
        <p className="mt-4 text-lead text-muted">{t('disabled')}</p>
      </Container>
    );
  }

  const session = await getCustomerSession();
  if (session) redirect('/account');

  return (
    <Container className="max-w-md py-16 lg:py-24">
      <h1 className="text-center font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
        {t('accountLoginTitle')}
      </h1>
      <p className="mt-3 text-center text-lead text-muted">{t('accountLoginIntro')}</p>
      <LoginClient linkIssue={issue === 'link'} />
      <p className="mt-6 text-center text-caption text-muted">{t('accountLoginSmsNote')}</p>
    </Container>
  );
}
