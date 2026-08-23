'use client';

import { useTranslations } from 'next-intl';
import { useCart } from './CartProvider';

/**
 * מונה הסל בכותרת (פרק 6.7): מוצג בכל העמודים, מתעדכן מיידית מהמצב
 * המקומי (בלי קריאת שרת לכל עמוד). מחוץ ל-CartProvider או כשהעגלה
 * כבויה — לא מרונדר כלל.
 */
export function CartIndicator() {
  const t = useTranslations('store');
  const cart = useCart();
  if (!cart?.enabled) return null;

  return (
    <button
      type="button"
      onClick={cart.openMiniCart}
      aria-label={t('cartAria', { count: cart.count })}
      aria-haspopup="dialog"
      className="relative flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-ink-soft transition-colors hover:text-burgundy"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 6h2l2.4 10.2a1.5 1.5 0 0 0 1.46 1.15h6.9a1.5 1.5 0 0 0 1.45-1.1L20.5 9H7" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10.5" cy="20" r="1.15" fill="currentColor" stroke="none" />
        <circle cx="16.5" cy="20" r="1.15" fill="currentColor" stroke="none" />
      </svg>
      {cart.count > 0 ? (
        <span
          aria-hidden="true"
          className="absolute end-0.5 top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-[var(--radius-pill)] bg-burgundy px-1 text-[0.65rem] font-bold leading-none text-cream tabular-nums"
        >
          {cart.count > 99 ? '99+' : cart.count}
        </span>
      ) : null}
    </button>
  );
}
