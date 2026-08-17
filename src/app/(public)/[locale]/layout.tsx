import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FONT_VARIABLES } from '@/lib/fonts';
import { CustomFontsStyle } from '@/components/CustomFontsStyle';
import { PlaceholderArtProvider } from '@/components/placeholder-art-context';
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
import { ChromeGate } from '@/components/ChromeGate';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CheckoutHeader } from '@/components/store/checkout/CheckoutHeader';
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

  const [settings, flags, t, tBooks] = await Promise.all([
    getSiteSettings(),
    getCommerceFlags(),
    getTranslations('site'),
    getTranslations('books'),
  ]);
  const dir = localeDirection[locale as Locale];

  // [1.12] תמונות הבסיס לספרים חסרי-תמונה (ניהול ← הגדרות) — ראו
  // placeholder-art-context.tsx
  const extra = settings.extra ?? {};
  const placeholderArt = {
    coverUrl: typeof extra.book_base_cover_url === 'string' ? extra.book_base_cover_url : null,
    spineUrl: typeof extra.book_base_spine_url === 'string' ? extra.book_base_spine_url : null,
    captionLabel: tBooks('illustrativeImage'),
  };

  return (
    <html lang={locale} dir={dir} className={FONT_VARIABLES}>
      <head>
        {/* מוחל לפני הצביעה הראשונה — מונע הבזק אצל מי שבחר ניגודיות או הגדלה */}
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
        {/* גופנים מותקנים (ניהול ← הגדרות ← גופנים) — @font-face + משתני CSS */}
        <CustomFontsStyle />
      </head>
      <body>
        <NextIntlClientProvider>
          <PlaceholderArtProvider value={placeholderArt}>
          <CartProvider enabled={flags.cartEnabled} locale={locale}>
            <a href="#main" className="skip-link">
              {t('skipToContent')}
            </a>
            {/* [1.4] "אין שום התייחסות ל-offline" (ביקורת המימוש, פער 23) —
                רצועה גלובלית, לא רק בקופה: ניתוק פוגע בסל ובמועדפים לא
                פחות מבתשלום עצמו. */}
            <OfflineBanner />
            {/* [1.4] הקופה מקבלת כותרת רזה בלי ניווט מלא/פוטר/באנר עוגיות/
                וידג'ט נגישות (ביקורת המימוש ב.17) — הבחירה בפועל ב-ChromeGate,
                לפי הנתיב הנוכחי בצד הלקוח. */}
            <ChromeGate
              header={<SiteHeader settings={settings} />}
              checkoutHeader={<CheckoutHeader />}
              footer={
                <>
                  <SiteFooter settings={settings} locale={locale} />
                  <AccessibilityWidget />
                  <BackToTop />
                  <CookieConsentBanner />
                </>
              }
            >
              {children}
            </ChromeGate>
            <AnalyticsBeacon />
            <MiniCart />
          </CartProvider>
          </PlaceholderArtProvider>
        </NextIntlClientProvider>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
