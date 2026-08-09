import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ensureCustomerRecord, getCustomerSession } from '@/lib/commerce/account';
import { AccountSettings } from '@/components/store/account/AccountSettings';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('settingsTitle'), robots: { index: false } };
}

/** [1.3] הגדרות חשבון (פרק 4.8) — פרטים אישיים, העדפות התראה ומחיקת חשבון. */
export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');

  const session = await getCustomerSession();
  if (!session) return null;
  const customer = session.customer ?? (await ensureCustomerRecord(session));

  // הטלפון הזמני של חשבון שנפתח בלי הזמנת מקור אינו מוצג כטלפון אמיתי
  const phone = customer?.phone && !customer.phone.startsWith('pending:') ? customer.phone : '';

  return (
    <>
      <nav className="text-caption text-muted">
        <Link href="/account" className="underline-offset-2 hover:text-burgundy hover:underline">
          {t('accountBackToAccount')}
        </Link>
      </nav>
      <header className="mt-4">
        <p className="eyebrow">{t('accountTitle')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.6rem,3.4vw,2.2rem)] text-ink">
          {t('settingsTitle')}
        </h1>
      </header>
      <div className="mt-8">
        <AccountSettings
          initialName={customer?.full_name ?? ''}
          initialPhone={phone}
          initialEmail={customer?.email ?? session.email ?? ''}
          initialMarketingEmail={customer?.marketing_email_opt_in ?? false}
          initialChannelSms={customer?.channel_sms_opt_in ?? false}
          initialChannelWhatsapp={customer?.channel_whatsapp_opt_in ?? false}
        />
      </div>
    </>
  );
}
