'use client';

import { useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';
import { useCart } from '../CartProvider';

/**
 * רצועת האקספרס (פרק 7.2): Bit / Apple Pay / Google Pay מעל הטופס.
 * מוצגת רק כשהדגל express_checkout_enabled פעיל — כלומר אחרי שאימות
 * מורנינג 9.3.1 (קביעת אמצעי מראש ב-API) הוכרע. הבחירה נשמרת על
 * ה-session; דף התשלום ייפתח עם האמצעי שנבחר.
 *
 * Apple Pay מוצג רק במכשירים שתומכים בו (ApplePaySession) — כפתור ארנק
 * שאינו יכול לפעול הוא הבטחה שווא.
 */
export function ExpressStrip({
  onSelect,
  selected,
}: {
  onSelect: (wallet: 'bit' | 'apple_pay' | 'google_pay') => void;
  selected: 'bit' | 'apple_pay' | 'google_pay' | null;
}) {
  const t = useTranslations('store');
  const locale = useLocale();
  const cart = useCart();
  // ערך חד-פעמי מהדפדפן, באותה תבנית useSyncExternalStore של client-hooks:
  // בשרת false, בלקוח נקרא ישירות — בלי setState בתוך אפקט
  const applePayAvailable = useSyncExternalStore(
    () => () => {},
    () =>
      'ApplePaySession' in window &&
      Boolean(
        (window as { ApplePaySession?: { canMakePayments?: () => boolean } }).ApplePaySession?.canMakePayments?.(),
      ),
    () => false,
  );

  function choose(wallet: 'bit' | 'apple_pay' | 'google_pay') {
    onSelect(wallet);
    void recordCommerceEvent('express_checkout_used', {
      sessionKey: cart?.sessionKey ?? '',
      locale,
      meta: { wallet },
    }).catch(() => {});
  }

  const base =
    'flex-1 rounded-[var(--radius-md)] border px-4 py-3 text-small font-semibold transition-colors';
  const active = 'border-gold bg-gold/15 text-ink';
  const idle = 'border-rule bg-white/60 text-ink-soft hover:border-gold/60';

  return (
    <section aria-label={t('expressTitle')} className="rounded-[var(--radius-lg)] border border-rule bg-cream px-5 py-4 shadow-[var(--shadow-soft)]">
      <p className="text-small font-semibold text-ink">{t('expressTitle')}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => choose('bit')}
          aria-pressed={selected === 'bit'}
          className={`${base} ${selected === 'bit' ? active : idle}`}
        >
          bit
        </button>
        {applePayAvailable ? (
          <button
            type="button"
            onClick={() => choose('apple_pay')}
            aria-pressed={selected === 'apple_pay'}
            className={`${base} ${selected === 'apple_pay' ? active : idle}`}
          >
            {/* "Apple Pay" בטקסט — תו הלוגו של אפל () אינו קיים מחוץ
                למכשירי אפל ומרונדר כריבוע שבור בכל מקום אחר */}
            Apple Pay
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => choose('google_pay')}
          aria-pressed={selected === 'google_pay'}
          className={`${base} ${selected === 'google_pay' ? active : idle}`}
        >
          Google Pay
        </button>
      </div>
      <p className="mt-2 text-caption text-muted">{t('orRegular')}</p>
    </section>
  );
}
