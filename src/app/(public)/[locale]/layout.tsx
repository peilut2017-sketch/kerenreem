import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FONT_VARIABLES } from '@/lib/fonts';
import { routing, localeDirection, type Locale } from '@/i18n/routing';
import { getSiteSettings } from '@/lib/data';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { CartProvider } from '@/components/store/CartProvider';
import { MiniCart } from '@/components/store/MiniCart';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AccessibilityWidget } from '@/components/AccessibilityWidget';
import { BackToTop } from '@/components/BackToTop';
import { AnalyticsBeacon } from '@/components/AnalyticsBeacon';
import { GoogleAnalytics } from '@/components/GoogleAnalytics';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';
import { A11Y_INIT_SCRIPT } from '@/lib/a11y-preferences';
import '../../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'site' });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: t('name'),
      template: `%s · ${t('name')}`,
    },
    description: t('tagline'),
    openGraph: {
      siteName: t('name'),
      locale: locale === 'he' ? 'he_IL' : 'en_US',
      type: 'website',
    },
    alternates: {
      languages: {
        he: '/',
        en: '/en',
      },
    },
    robots: { index: true, follow: true },
    // הלוגו שהועלה ב-CMS, מוגש דרך /site-icon (ראו שם) עם נפילה לסימן
    // הקבוע כשלא הועלה לוגו — ולא קובץ סטטי, כי הלוגו יכול להתעדכן.
    icons: { icon: '/site-icon' },
  };
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);

  const [settings, flags, t] = await Promise.all([
    getSiteSettings(),
    getCommerceFlags(),
    getTranslations('site'),
  ]);
  const dir = localeDirection[locale as Locale];

  return (
    <html lang={locale} dir={dir} className={FONT_VARIABLES}>
      <head>
        {/* מוחל לפני הצביעה הראשונה — מונע הבזק אצל מי שבחר ניגודיות או הגדלה */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <CartProvider enabled={flags.cartEnabled} locale={locale}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            <SiteHeader settings={settings} />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter settings={settings} locale={locale} />
            <AccessibilityWidget />
            <BackToTop />
            <AnalyticsBeacon />
            <CookieConsentBanner />
            <MiniCart />
          </CartProvider>
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
