'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Drawer } from '../Drawer';
import { BookCover } from '../BookCover';
import { formatPrice } from '@/lib/commerce/pricing';
import { useCart } from './CartProvider';
import { FreeShippingBar } from './FreeShippingBar';

/**
 * ה-Mini Cart (פרק 6.3): מגירת צד קלה על Drawer הקיים — לכידת מיקוד,
 * Escape ורקע כבר שם. שורות, כמות, סכום ביניים, פס משלוח חינם, תאריך
 * משוער, ומעבר לעגלה/לתשלום. מקום שמור לכפתורי האקספרס — מוצג רק
 * כשהדגל פעיל (שלב 4).
 */
export function MiniCart() {
  const t = useTranslations('store');
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const titleId = useId();

  if (!cart?.enabled) return null;
  const view = cart.view;
  const lines = view?.cart.lines ?? [];

  return (
    <Drawer
      open={cart.miniCartOpen}
      onClose={cart.closeMiniCart}
      titleId={titleId}
      title={t('cart')}
      closeLabel={t('closeCart')}
      widthClassName="max-w-[26rem]"
      footer={
        cart.count > 0 ? (
          <div className="flex w-full flex-col gap-3">
            {view ? (
              <div className="flex items-baseline justify-between text-small text-ink">
                <span>{t('subtotal')}</span>
                <strong className="font-serif text-h3">{formatPrice(view.cart.subtotal, locale)}</strong>
              </div>
            ) : null}
            <div className="flex gap-3">
              <Link
                href="/cart"
                onClick={cart.closeMiniCart}
                className="btn btn-quiet flex-1 text-center"
              >
                {t('toCart')}
              </Link>
              {view?.flags.checkoutEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    cart.closeMiniCart();
                    router.push('/checkout');
                  }}
                  className="btn btn-solid flex-1"
                >
                  {t('toCheckout')}
                </button>
              ) : null}
            </div>
          </div>
        ) : undefined
      }
    >
      {cart.count === 0 ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-small text-muted">{t('cartEmpty')}</p>
          <Link href="/books" onClick={cart.closeMiniCart} className="btn btn-quiet">
            {t('cartEmptyCta')}
          </Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {lines.map((line) => (
            <li key={line.bookId} className="flex gap-3">
              <div className="w-14 shrink-0">
                <BookCover src={line.coverImageUrl} title={line.title} alt="" sizes="56px" />
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/books/${line.slug}`}
                  onClick={cart.closeMiniCart}
                  className="line-clamp-2 text-small font-semibold text-ink hover:text-burgundy"
                >
                  {line.title}
                </Link>
                {line.removedReason ? (
                  <p className="mt-1 text-caption text-burgundy">
                    {line.removedReason === 'out_of_stock' ? t('outOfStockLine') : t('unavailableLine')}
                  </p>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <QuantityStepper
                      title={line.title}
                      quantity={line.quantity}
                      max={line.availableQuantity ?? 99}
                      onChange={(next) => cart.setQuantity(line.bookId, next)}
                    />
                    <span className="text-small text-ink tabular-nums">
                      {formatPrice(line.lineTotal, locale)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => cart.remove(line.bookId)}
                  className="mt-1.5 text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
                >
                  {t('remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {view && cart.count > 0 ? (
        <div className="mt-6 space-y-3 border-t border-rule pt-4">
          <FreeShippingBar view={view} />
          {view.estimatedDeliveryLabel ? (
            <p className="text-caption text-muted">
              {t('deliveryEstimate', { date: view.estimatedDeliveryLabel })}
            </p>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function QuantityStepper({
  title,
  quantity,
  max,
  onChange,
}: {
  title: string;
  quantity: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations('store');
  return (
    <span
      role="group"
      aria-label={t('quantityFor', { title })}
      className="inline-flex items-center rounded-[var(--radius-pill)] border border-rule"
    >
      <button
        type="button"
        aria-label={t('decreaseQty')}
        onClick={() => onChange(quantity - 1)}
        className="px-2.5 py-1 text-ink-soft hover:text-burgundy"
      >
        −
      </button>
      <span aria-live="polite" className="min-w-6 text-center text-small tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        aria-label={t('increaseQty')}
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
        className="px-2.5 py-1 text-ink-soft hover:text-burgundy disabled:opacity-40"
      >
        +
      </button>
    </span>
  );
}
