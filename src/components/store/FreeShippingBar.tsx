'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/commerce/pricing';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';
import { useCart } from './CartProvider';
import type { CartViewModel } from '@/lib/commerce/cart-actions';

/**
 * פס ההתקדמות למשלוח חינם (פרק 3.3 — דרישה מחייבת): "עוד X ₪ למשלוח
 * חינם" בעגלה וב-Mini Cart. מוצג רק כשמוגדר סף בהגדרות החנות; מידע,
 * לא לחץ.
 */
export function FreeShippingBar({ view }: { view: CartViewModel }) {
  const t = useTranslations('store');
  const locale = useLocale();
  const cart = useCart();
  const reported = useRef(false);

  const threshold = view.freeShipping.threshold;

  useEffect(() => {
    if (threshold != null && !reported.current && cart) {
      reported.current = true;
      void recordCommerceEvent('free_shipping_progress_shown', {
        sessionKey: cart.sessionKey,
        locale,
      }).catch(() => {});
    }
  }, [threshold, cart, locale]);

  if (threshold == null) return null;

  const achieved = view.freeShipping.achieved;
  const remaining = view.freeShipping.remaining;
  const progress = Math.min((view.cart.subtotal / threshold) * 100, 100);

  return (
    <div>
      <p className="text-caption text-ink-soft" aria-live="polite">
        {achieved
          ? t('freeShippingAchieved')
          : remaining != null
            ? t('freeShippingProgress', { amount: formatPrice(remaining, locale) })
            : t('freeShippingIneligible')}
      </p>
      <div
        role="progressbar"
        aria-label={t('freeShippingProgressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="mt-1.5 h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-cream-2"
      >
        <div
          className="h-full rounded-[var(--radius-pill)] bg-gold transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
