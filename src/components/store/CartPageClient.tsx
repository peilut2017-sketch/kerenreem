'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { formatPrice } from '@/lib/commerce/pricing';
import { useCart } from './CartProvider';
import { FreeShippingBar } from './FreeShippingBar';
import { QuantityStepper } from './MiniCart';
import { useLocalList } from '@/lib/client-hooks';

/**
 * גוף עמוד העגלה (פרק 6.4) — רענון 1.1: שורות ככרטיסים קלים, קופון כבר
 * בעגלה (הכרעה 13), סיכום דביק עם שורת הנחה. כל הסכומים מהאימות השרתי
 * (view) — הרכיב אינו מחשב מחיר בעצמו; שינויים שהתגלו (מחיר/כמות/
 * זמינות) מוצגים מפורשות, לעולם לא מעודכנים בשקט.
 */
export function CartPageClient() {
  const t = useTranslations('store');
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const favourites = useLocalList('kr:favourites');

  if (!cart?.enabled) {
    return <p className="py-16 text-center text-muted">{t('disabled')}</p>;
  }

  if (cart.count === 0) {
    return (
      <div className="flex flex-col items-center gap-5 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-cream-2 text-ink-soft">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h2l2.4 10.2a1.5 1.5 0 0 0 1.46 1.15h6.9a1.5 1.5 0 0 0 1.45-1.1L20.5 9H7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
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
  const coupon = view?.coupon ?? null;
  const appliedCoupon = coupon && coupon.ok ? coupon : null;
  const discount = appliedCoupon?.discountAmount ?? 0;
  const freeShippingByCoupon = Boolean(appliedCoupon?.freeShipping);
  // הסכום מהשרת — אותו מספר בדיוק בעמוד הסל, במיני-סל ובקופה; החישוב
  // המקומי הקודם שוכפל בשלושה מסכים וכבר סטה ביניהם.
  const totalEstimated = view?.estimatedTotal ?? 0;

  return (
    <div className="mt-8 grid grid-cols-1 items-start gap-8 pb-24 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <div>
        {changes.length > 0 ? (
          <div role="status" className="mb-6 rounded-[var(--radius-md)] border border-gold/40 bg-gold/10 px-4 py-3 text-small text-ink">
            <ul className="space-y-1">
              {changes.map((change) => (
                <li key={`${change.bookId}-${change.kind}`}>
                  {change.kind === 'price' && change.previousPrice != null && change.newPrice != null
                    ? t('priceChangedNoteAmounts', {
                        title: change.title,
                        oldPrice: formatPrice(change.previousPrice, locale),
                        newPrice: formatPrice(change.newPrice, locale),
                      })
                    : change.kind === 'quantity' && change.availableQuantity != null
                      ? t('quantityAdjustedAmounts', { title: change.title, available: change.availableQuantity })
                      : `${change.title}: ${t('unavailableLine')}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <ul className="space-y-3">
          {lines.map((line) => (
            <li
              key={line.bookId}
              className="group flex gap-4 rounded-[var(--radius-lg)] border border-rule/70 bg-cream px-4 py-4 shadow-[var(--shadow-soft)] transition-shadow duration-300 hover:shadow-[var(--shadow-float)] sm:px-5"
            >
              <Link href={`/books/${line.slug}`} className="w-20 shrink-0 self-start">
                <BookCover src={line.coverImageUrl} title={line.title} alt="" sizes="80px" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="min-w-0">
                    <Link
                      href={`/books/${line.slug}`}
                      className="font-serif text-[1.0625rem] leading-snug text-ink hover:text-burgundy"
                    >
                      {line.title}
                    </Link>
                    {line.author ? <span className="block text-caption text-muted">{line.author}</span> : null}
                  </span>
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
                      /* preorderLine ולא statusPendingPayment: זה תיאור פריט
                         ("בהזמנה מוקדמת"), לא סטטוס הזמנה ("ממתינה לתשלום") */
                      <span className="text-caption text-muted">{t('preorderLine')}</span>
                    ) : null}
                    <span className="ms-auto flex items-center gap-1">
                      {/* הכפתור קבוע: שורה שהספר שלה כבר במועדפים איבדה אותו
                          בלי הסבר ונראתה שונה משכנותיה בלי סיבה נראית לעין */}
                      <button
                        type="button"
                        onClick={() => {
                          if (!favourites.has(line.bookId)) favourites.toggle(line.bookId);
                          cart.remove(line.bookId);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1.5 text-caption text-muted transition-colors hover:bg-gold/10 hover:text-burgundy"
                      >
                        {t('saveForLater')}
                      </button>
                      <button
                        type="button"
                        onClick={() => cart.remove(line.bookId)}
                        aria-label={`${t('remove')} — ${line.title}`}
                        className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1.5 text-caption text-muted transition-colors hover:bg-burgundy/10 hover:text-burgundy"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                          <path d="M4.5 6.5h15M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5v1.5M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
                        </svg>
                        {t('remove')}
                      </button>
                    </span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-center justify-between">
          <Link href="/books" className="text-small text-muted hover:text-burgundy">
            <span aria-hidden="true" className="inline-block ltr:-scale-x-100">→</span> {t('continueShopping')}
          </Link>
          <ClearCartButton onConfirm={cart.clear} />
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
              {appliedCoupon && discount > 0 ? (
                <div className="flex justify-between text-gold-deep">
                  <dt>
                    {t('discount')} · {appliedCoupon.code}
                  </dt>
                  <dd className="tabular-nums">−{formatPrice(discount, locale)}</dd>
                </div>
              ) : null}
              {view.promotion ? (
                <div className="flex justify-between text-gold-deep">
                  <dt>
                    {t('promotionLabel')} · {view.promotion.name}
                  </dt>
                  <dd className="tabular-nums">−{formatPrice(view.promotion.discountAmount, locale)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>{t('shippingEstimate')}</dt>
                <dd className="tabular-nums text-ink">
                  {view.freeShipping.achieved || freeShippingByCoupon
                    ? t('free')
                    : view.estimatedShipping != null
                      ? formatPrice(view.estimatedShipping, locale)
                      : t('shippingAtCheckout')}
                </dd>
              </div>
              <div className="flex justify-between border-t border-rule pt-2.5 text-ink">
                <dt className="font-semibold">{t('totalEstimated')}</dt>
                <dd className="font-serif text-h3 tabular-nums">
                  {formatPrice(totalEstimated, locale)}
                </dd>
              </div>
            </dl>

            {/* [1.1] קופון כבר בעגלה (הכרעה 13) — מאומת בשרת, נודד ל-Checkout */}
            {view.flags.couponsEnabled ? (
              <CartCouponField
                appliedCode={appliedCoupon?.code ?? null}
                freeShipping={freeShippingByCoupon}
                error={coupon && !coupon.ok ? coupon : null}
                busy={cart.loading}
                onApply={cart.setCouponCode}
                onRemove={cart.clearCoupon}
              />
            ) : null}

            <div className="mt-4">
              <FreeShippingBar view={view} />
            </div>

            {view.estimatedDeliveryLabel ? (
              <p className="mt-3 text-caption text-muted">
                {t('deliveryEstimate', { date: view.estimatedDeliveryLabel })} · {t('pickupAlways')}
              </p>
            ) : null}

            {cart.stale ? (
              /* האימות האחרון נכשל — הסכומים עלולים להיות ישנים. המעבר
                 לתשלום נחסם עד רענון מוצלח: אסור להתחיל קופה על סכומים
                 שלא אומתו. */
              <div role="alert" className="mt-4 rounded-[var(--radius-md)] border border-burgundy/40 bg-burgundy/5 px-4 py-3 text-small text-ink">
                {t('cartStaleNotice')}{' '}
                <button
                  type="button"
                  onClick={cart.refresh}
                  className="font-semibold text-burgundy underline underline-offset-2"
                >
                  {t('cartStaleRefresh')}
                </button>
              </div>
            ) : null}

            {view.flags.checkoutEnabled ? (
              <button
                type="button"
                disabled={cart.stale}
                onClick={() => router.push('/checkout')}
                className="btn btn-solid mt-5 w-full"
              >
                {t('toCheckout')}
              </button>
            ) : (
              /* הקופה כבויה: הודעה + טלפון במקום כפתור שפשוט נעלם —
                 סיכום מלא עם סכום ואפס דרך להתקדם נראה כמו אתר שבור */
              <p className="mt-5 rounded-[var(--radius-md)] bg-cream-2/80 px-4 py-3 text-center text-small text-ink-soft">
                {t('checkoutDisabledNotice')}
              </p>
            )}

            <p className="mt-4 text-center text-caption leading-relaxed text-muted">{t('cartTrust')}</p>

            {view.supportPhone ? (
              <p className="mt-2 text-center text-caption text-muted">
                {t('phoneHelp', { phone: view.supportPhone })}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <span role="status" className="sr-only">
              {t('loading')}
            </span>
            <div aria-hidden="true" className="mt-4 space-y-3">
              <div className="h-4 animate-pulse rounded bg-cream-2" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-cream-2" />
              <div className="h-10 animate-pulse rounded bg-cream-2" />
            </div>
          </>
        )}
      </aside>

      {/* CTA דביק במובייל: הסיכום יושב אחרי רשימת הפריטים — בעגלה של
          כמה ספרים "מעבר לתשלום" היה שלושה מסכי גלילה מתחת לקיפול.
          bottom לפי --consent-h, כדי לא להתנגש ברצועת העוגיות. */}
      {view && view.flags.checkoutEnabled ? (
        <div className="fixed inset-x-0 bottom-[var(--consent-h,0px)] z-40 border-t border-rule bg-cream/95 px-4 py-3 shadow-[0_-10px_30px_-18px_rgb(11_21_32/0.3)] backdrop-blur lg:hidden">
          <div className="mx-auto flex w-full max-w-xl items-center justify-between gap-4">
            <span className="text-small text-ink-soft">
              {t('totalEstimated')}{' '}
              <strong className="font-serif text-[1.125rem] text-ink tabular-nums">
                {formatPrice(totalEstimated, locale)}
              </strong>
            </span>
            <button
              type="button"
              disabled={cart.stale}
              onClick={() => router.push('/checkout')}
              className="btn btn-solid shrink-0 px-6 py-2.5"
            >
              {t('toCheckout')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * ריקון הסל באישור דו-שלבי במקום window.confirm — דיאלוג הדפדפן אינו
 * נגיש לקורא מסך, אינו מתורגם ואינו בשפת העיצוב. לחיצה ראשונה חושפת
 * אישור מפורש; בלי אישור תוך 5 שניות — חוזר לרגיל.
 */
function ClearCartButton({ onConfirm }: { onConfirm: () => void }) {
  const t = useTranslations('store');
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <span className="flex items-center gap-2 text-caption">
        <span className="text-ink-soft">{t('clearCartConfirm')}</span>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setArmed(false);
          }}
          className="font-semibold text-burgundy underline underline-offset-2"
        >
          {t('clearCart')}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-muted underline underline-offset-2 hover:text-ink"
        >
          {t('cancel')}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setArmed(true)}
      className="text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
    >
      {t('clearCart')}
    </button>
  );
}

function CartCouponField({
  appliedCode,
  freeShipping,
  error,
  busy,
  onApply,
  onRemove,
}: {
  appliedCode: string | null;
  freeShipping: boolean;
  error: { error?: string; minTotal?: number; code: string } | null;
  /** אימות שרת בעיצומו — הכפתור מציג "בודק…" במקום לשתוק עד שנייה וחצי */
  busy: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('store');
  const locale = useLocale();
  const [open, setOpen] = useState(Boolean(appliedCode || error));
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // התוצאה חזרה (busy ירד) — מזוהה בזמן הרינדור עצמו, כמו דפוס seenPathname
  const [prevBusy, setPrevBusy] = useState(busy);
  if (busy !== prevBusy) {
    setPrevBusy(busy);
    if (!busy && submitted) setSubmitted(false);
  }
  const checking = submitted && busy;

  if (appliedCode) {
    return (
      <p className="mt-4 flex items-center justify-between rounded-[var(--radius-md)] bg-gold/10 px-3.5 py-2.5 text-small text-ink">
        <span>
          {freeShipping
            ? t('couponFreeShippingApplied', { code: appliedCode })
            : `${t('coupon')}: ${appliedCode} ✓`}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
        >
          {t('couponRemove')}
        </button>
      </p>
    );
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-small text-muted underline-offset-2 hover:text-burgundy hover:underline"
        >
          {t('couponHave')}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) {
              setSubmitted(true);
              onApply(code);
            }
          }}
          className="flex gap-2"
        >
          <label htmlFor="cart-coupon" className="sr-only">
            {t('coupon')}
          </label>
          <input
            id="cart-coupon"
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('coupon')}
            className="min-w-0 flex-1 rounded-[var(--radius-md)] border border-rule bg-white/70 px-3 py-2 text-small uppercase tracking-wide text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
          <button type="submit" disabled={checking} className="btn btn-quiet shrink-0 px-4 py-2 text-small">
            {checking ? t('couponChecking') : t('couponApply')}
          </button>
        </form>
      )}
      {error?.error ? (
        <p role="alert" className="mt-2 text-caption text-burgundy">
          {error.error === 'min_total' && error.minTotal != null
            ? t('couponErrMinTotal', { amount: formatPrice(error.minTotal, locale) })
            : error.error === 'used_up'
              ? t('couponErrUsedUp')
              : error.error === 'not_applicable'
                ? t('couponErrNotApplicable')
                : error.error === 'not_combinable'
                  ? t('couponErrNotCombinable')
                  : t('couponErrInvalid')}
        </p>
      ) : null}
    </div>
  );
}
