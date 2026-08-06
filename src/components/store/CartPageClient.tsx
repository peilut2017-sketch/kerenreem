'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { formatPrice } from '@/lib/commerce/pricing';
import { useCart } from './CartProvider';
import { FreeShippingBar } from './FreeShippingBar';
import { QuantityStepper } from './MiniCart';

/**
 * גוף עמוד העגלה (פרק 6.4). כל הסכומים מהאימות השרתי (view) — הרכיב
 * אינו מחשב מחיר בעצמו; שינויים שהתגלו (מחיר/כמות/זמינות) מוצגים
 * מפורשות בראש העמוד, לעולם לא מעודכנים בשקט.
 */
export function CartPageClient() {
  const t = useTranslations('store');
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();

  if (!cart?.enabled) {
    return <p className="py-16 text-center text-muted">{t('disabled')}</p>;
  }

  if (cart.count === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-16 text-center">
        <p className="text-lead text-muted">{t('cartEmpty')}</p>
        <Link href="/books" className="btn btn-solid">
          {t('cartEmptyCta')}
        </Link>
      </div>
    );
  }

  const view = cart.view;
  const lines = view?.cart.lines ?? [];
  const changes = view?.cart.changes ?? [];

  return (
    <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_22rem]">
      <div>
        {changes.length > 0 ? (
          <div role="status" className="mb-6 rounded-[var(--radius-md)] border border-gold/40 bg-gold/10 px-4 py-3 text-small text-ink">
            <ul className="space-y-1">
              {changes.map((change) => (
                <li key={`${change.bookId}-${change.kind}`}>
                  {change.kind === 'price'
                    ? t('priceChangedNote', { title: change.title })
                    : change.kind === 'quantity'
                      ? `${change.title}: ${t('quantityAdjusted')}`
                      : `${change.title}: ${t('unavailableLine')}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="divide-y divide-rule">
          {lines.map((line) => (
            <li key={line.bookId} className="flex gap-4 py-5">
              <div className="w-20 shrink-0">
                <BookCover src={line.coverImageUrl} title={line.title} alt="" sizes="80px" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link
                    href={`/books/${line.slug}`}
                    className="font-serif text-[1.0625rem] text-ink hover:text-burgundy"
                  >
                    {line.title}
                  </Link>
                  {line.removedReason === null ? (
                    <span className="inline-flex items-baseline gap-2 text-ink tabular-nums">
                      {line.onSale && line.originalUnitPrice != null ? (
                        <s className="text-caption text-muted">
                          {formatPrice(line.originalUnitPrice * line.quantity, locale)}
                        </s>
                      ) : null}
                      <strong className="font-serif">{formatPrice(line.lineTotal, locale)}</strong>
                    </span>
                  ) : null}
                </div>

                {line.removedReason ? (
                  <p className="mt-2 text-small text-burgundy">
                    {line.removedReason === 'out_of_stock' ? t('outOfStockLine') : t('unavailableLine')}
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <QuantityStepper
                      title={line.title}
                      quantity={line.quantity}
                      max={line.availableQuantity ?? 99}
                      onChange={(next) => cart.setQuantity(line.bookId, next)}
                    />
                    {line.availableQuantity != null && line.availableQuantity <= 2 ? (
                      <span className="text-caption text-gold-deep">
                        {t('lastCopies', { count: line.availableQuantity })}
                      </span>
                    ) : null}
                    {line.isPreorder ? (
                      <span className="text-caption text-muted">{t('statusPendingPayment')}</span>
                    ) : null}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => cart.remove(line.bookId)}
                  className="mt-2 text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
                >
                  {t('remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <Link href="/books" className="text-small text-muted hover:text-burgundy">
            ← {t('continueShopping')}
          </Link>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('clearCartConfirm'))) cart.clear();
            }}
            className="text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
          >
            {t('clearCart')}
          </button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-28 rounded-[var(--radius-lg)] border border-rule bg-cream px-6 py-6 shadow-[var(--shadow-soft)]">
        <h2 className="font-serif text-h3 text-ink">{t('summaryTitle')}</h2>
        {view ? (
          <>
            <dl className="mt-4 space-y-2.5 text-small text-ink-soft">
              <div className="flex justify-between">
                <dt>
                  {t('subtotal')} · {t('itemsCount', { count: view.cart.totalQuantity })}
                </dt>
                <dd className="tabular-nums text-ink">{formatPrice(view.cart.subtotal, locale)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t('shippingEstimate')}</dt>
                <dd className="tabular-nums text-ink">
                  {view.freeShipping.achieved
                    ? t('free')
                    : view.estimatedShipping != null
                      ? formatPrice(view.estimatedShipping, locale)
                      : t('shippingAtCheckout')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2.5 text-ink">
                <dt className="font-semibold">{t('totalEstimated')}</dt>
                <dd className="font-serif text-h3 tabular-nums">
                  {formatPrice(
                    view.cart.subtotal +
                      (view.freeShipping.achieved ? 0 : (view.estimatedShipping ?? 0)),
                    locale,
                  )}
                </dd>
              </div>
            </dl>

            <div className="mt-4">
              <FreeShippingBar view={view} />
            </div>

            {view.estimatedDeliveryLabel ? (
              <p className="mt-3 text-caption text-muted">
                {t('deliveryEstimate', { date: view.estimatedDeliveryLabel })} · {t('pickupAlways')}
              </p>
            ) : null}

            {view.flags.checkoutEnabled ? (
              <button
                type="button"
                onClick={() => router.push('/checkout')}
                className="btn btn-solid mt-5 w-full"
              >
                {t('toCheckout')}
              </button>
            ) : null}

            {view.supportPhone ? (
              <p className="mt-4 text-center text-caption text-muted">
                {t('phoneHelp', { phone: view.supportPhone })}
              </p>
            ) : null}
          </>
        ) : (
          <div aria-hidden="true" className="mt-4 space-y-3">
            <div className="h-4 animate-pulse rounded bg-cream-2" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-cream-2" />
            <div className="h-10 animate-pulse rounded bg-cream-2" />
          </div>
        )}
      </aside>
    </div>
  );
}
