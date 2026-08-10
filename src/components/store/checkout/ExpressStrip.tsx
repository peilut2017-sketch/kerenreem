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

  return (
    <section aria-label={t('expressTitle')} className="rounded-[var(--radius-lg)] border border-rule bg-cream px-5 py-4 shadow-[var(--shadow-soft)]">
      <p className="text-small font-semibold text-ink">{t('expressTitle')}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" onClick={() => choose('bit')} aria-pressed={selected === 'bit'} className="wallet-btn">
          <WalletGlyph />
          bit
        </button>
        {applePayAvailable ? (
          <button type="button" onClick={() => choose('apple_pay')} aria-pressed={selected === 'apple_pay'} className="wallet-btn">
            <AppleGlyph />
            Apple Pay
          </button>
        ) : null}
        <button type="button" onClick={() => choose('google_pay')} aria-pressed={selected === 'google_pay'} className="wallet-btn">
          <WalletGlyph />
          Google Pay
        </button>
      </div>
      <p className="mt-2 text-caption text-muted">{t('orRegular')}</p>
    </section>
  );
}

function WalletGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9Z" />
      <path d="M15.5 12.5h3M3.5 9.5h17" />
    </svg>
  );
}

/* [1.6] תוקן: הכפתור הציג בעבר את תו הלוגו הפרטי של Apple (U+F8FF), הנתמך
   רק בגופני Apple — בכל דפדפן/מערכת אחרים הוא נראה כתו ריק, ולכן "Pay"
   הופיע לבדו בלי שם הארנק. אייקון תפוח קווי ניטרלי מציג את הזהות בלי
   תלות בגופן. */
function AppleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor" stroke="none">
      <path d="M16.4 2.6c.1 1-.3 2-.9 2.7-.6.7-1.6 1.3-2.6 1.2-.1-1 .4-2 1-2.7.6-.7 1.7-1.2 2.5-1.2ZM19.9 17c-.5 1.1-.7 1.6-1.3 2.6-.9 1.4-2.1 3.1-3.6 3.1-1.4 0-1.7-.9-3.5-.9-1.8 0-2.2.9-3.5.9-1.5 0-2.6-1.6-3.5-2.9-2.4-3.5-2.7-7.6-1.2-9.8 1.1-1.6 2.7-2.5 4.3-2.5 1.6 0 2.6.9 3.9.9 1.3 0 2.1-.9 3.9-.9 1.4 0 2.9.8 4 2.1-3.5 1.9-2.9 6.9.5 8.4Z" />
    </svg>
  );
}
