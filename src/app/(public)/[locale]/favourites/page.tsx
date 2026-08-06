import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { getSiteSettings } from '@/lib/data';
import { FavouritesClient } from '@/components/store/FavouritesClient';

/**
 * "הספרים שאהבתי" (פרק 5, דרישת 1.1): עמוד ציבורי — עובד גם לאורח, בלי
 * חשבון; הרשימה חיה במכשיר. נגיש מאייקון הספר שבכותרת.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'store' });
  return { title: t('favouritesTitle'), robots: { index: false } };
}

export default async function FavouritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('store');
  const settings = await getSiteSettings();

  return (
    <Container className="py-12 lg:py-16">
      <header className="text-center">
        <p className="eyebrow">{t('favouritesEyebrow')}</p>
        <h1 className="mt-2 font-serif text-[clamp(1.7rem,3.6vw,2.4rem)] text-ink">
          {t('favouritesTitle')}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-lead text-muted">{t('favouritesIntro')}</p>
      </header>
      <div className="mt-10">
        <FavouritesClient locale={locale} storeEnabled={Boolean(settings?.store_enabled)} />
      </div>
    </Container>
  );
}
