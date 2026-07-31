import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Frank_Ruhl_Libre, Assistant } from 'next/font/google';
import { routing, localeDirection, type Locale } from '@/i18n/routing';
import { getSiteSettings } from '@/lib/data';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { AccessibilityWidget } from '@/components/AccessibilityWidget';
import { A11Y_INIT_SCRIPT } from '@/lib/a11y-preferences';
import '../../globals.css';

/**
 * שני גופנים, לא יותר.
 * Frank Ruhl — סריף עברי שנחתך במקור עבור ספרים; הוא נושא את הכותרות.
 * Assistant  — סנס נקי לממשק ולגוף הטקסט.
 */
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-frank',
  display: 'swap',
});

const assistant = Assistant({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-assistant',
  display: 'swap',
});

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

  const [settings, t] = await Promise.all([getSiteSettings(), getTranslations('site')]);
  const dir = localeDirection[locale as Locale];

  return (
    <html lang={locale} dir={dir} className={`${frank.variable} ${assistant.variable}`}>
      <head>
        {/* מוחל לפני הצביעה הראשונה — מונע הבזק אצל מי שבחר ניגודיות או הגדלה */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider>
          <a href="#main" className="skip-link">
            {t('skipToContent')}
          </a>
          <SiteHeader settings={settings} />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter settings={settings} locale={locale} />
          <AccessibilityWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
