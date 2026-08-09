import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Wordmark } from '@/components/Wordmark';
import { getSiteSettings } from '@/lib/data';
import { getStoreSettings } from '@/lib/commerce/settings';

/**
 * [1.4] כותרת הקופה — לוגו + חזרה לסל + טלפון עזרה + חיווי "תשלום
 * מאובטח", בלי ניווט מלא (ביקורת המימוש ב.17): לפני התיקון /checkout
 * נטען עם ה-SiteHeader המלא (כל קישורי הניווט, מועדפים, חשבון, מונה
 * סל שפותח Mini Cart, חיפוש, מתג שפה) — בדיוק הדרך היחידה החוצה
 * מהקופה שהמפרט ביקש למנוע.
 */
export async function CheckoutHeader() {
  const [t, settings, storeSettings] = await Promise.all([
    getTranslations(),
    getSiteSettings(),
    getStoreSettings(),
  ]);

  return (
    <header className="border-b border-rule bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
        <Wordmark logoUrl={settings.logo_url} name={t('site.name')} compact />
        <div className="flex flex-wrap items-center gap-4 text-caption text-muted">
          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
            <LockIcon />
            {t('store.secureCheckoutBadge')}
          </span>
          {storeSettings.support_phone ? (
            <a
              href={`tel:${storeSettings.support_phone}`}
              dir="ltr"
              className="hover:text-burgundy"
              title={t('store.checkoutHelpPhone')}
            >
              {storeSettings.support_phone}
            </a>
          ) : null}
          <Link href="/cart" className="font-semibold text-ink-soft hover:text-burgundy">
            {t('store.backToCart')}
          </Link>
        </div>
      </div>
    </header>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
      <rect x="4.5" y="8.5" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
