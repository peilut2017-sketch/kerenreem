'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { BookCover } from '../../BookCover';
import { formatPrice, round2 } from '@/lib/commerce/pricing';
import {
  applyCoupon,
  placeOrder,
  removeCoupon,
  saveContact,
  saveExtras,
  saveFulfillment,
  startCheckout,
  type CheckoutBootstrap,
  type MethodOption,
} from '@/lib/commerce/checkout-actions';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';
import { useCart } from '../CartProvider';
import { ContactBlock, type ContactValues } from './ContactBlock';
import { FulfillmentBlock, type FulfillmentValues } from './FulfillmentBlock';
import { ReviewBlock, type ExtrasValues } from './ReviewBlock';
import { ExpressStrip } from './ExpressStrip';

/**
 * גוף ה-Checkout (תרשים 4): שלושה בלוקים בעמוד אחד — זיהוי → אספקה →
 * סקירה — עם סיכום דביק. ההתקדמות נשמרת ב-checkout session בצד השרת
 * (רענון משחזר); הסכום המחייב מחושב בשרת, והמוצג כאן נשלח להשוואה
 * ב-placeOrder — פער עוצר, לא מחייב בשקט.
 */

type BlockId = 'contact' | 'fulfillment' | 'review';

export function CheckoutClient() {
  const t = useTranslations('store');
  const locale = useLocale();
  const router = useRouter();
  const cart = useCart();
  const [bootstrap, setBootstrap] = useState<CheckoutBootstrap | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [openBlock, setOpenBlock] = useState<BlockId>('contact');
  const [contactDone, setContactDone] = useState(false);
  const [fulfillmentDone, setFulfillmentDone] = useState(false);
  const [method, setMethod] = useState<MethodOption | null>(null);
  const [placing, setPlacing] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [wallet, setWallet] = useState<'bit' | 'apple_pay' | 'google_pay' | null>(null);
  const [coupon, setCoupon] = useState<{
    code: string;
    discountAmount: number;
    freeShipping: boolean;
  } | null>(null);
  const started = useRef(false);
  const redirectingRef = useRef(false);
  // [1.6] סיכום מתקפל במובייל (ח.11) — פתוח תמיד מ-lg ומעלה, ללא תלות ב-state הזה
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  const items = cart?.items ?? [];

  /**
   * [1.4] לפני התיקון הפונקציה הזו רצה בלי try/catch בכלל: כשל רשת אמיתי
   * ב-startCheckout (לא כשל עסקי — {ok:false} כבר מטופל כראוי, אלא throw
   * כמו ניתוק) השאיר את bootstrap===null לנצח, ו-started.current שכבר
   * הפך ל-true חסם כל ניסיון חוזר — שלד טעינה נצחי בלי דרך לצאת ממנו.
   * עכשיו הכשל נתפס, מוצג מסך שגיאה עם "ניסיון נוסף" שקורא לפונקציה
   * הזו שוב ישירות (בלי דרך started.current, ששייך רק לניסיון האוטומטי).
   */
  const runBootstrap = useCallback(async () => {
    if (!cart || items.length === 0) return;
    setBootstrapError(false);
    try {
      const result = await startCheckout(items, locale);
      setBootstrap(result);
      if (result.session) {
        const hasContact = Boolean(result.session.contact_phone && result.session.contact_email);
        setContactDone(hasContact);
        const savedMethod = result.methods.find(
          (m) => m.id === result.session?.fulfillment?.method_id,
        );
        if (savedMethod) {
          setMethod(savedMethod);
          setFulfillmentDone(true);
        }
        setOpenBlock(!hasContact ? 'contact' : !savedMethod ? 'fulfillment' : 'review');
      }
      // [1.1] קופון שנקלט כבר בעגלה (kr:coupon) או ששרד ב-session —
      // מוחל אוטומטית; האימות המחייב ממילא רץ שוב ב-placeOrder
      const sessionCoupon = result.session?.coupon_code ?? null;
      let storedCoupon: string | null = null;
      try {
        storedCoupon = window.localStorage.getItem('kr:coupon');
      } catch {
        storedCoupon = null;
      }
      const codeToApply = sessionCoupon ?? storedCoupon;
      if (result.ok && codeToApply) {
        try {
          const applied = await applyCoupon(codeToApply);
          if (applied.ok && applied.code) {
            setCoupon({
              code: applied.code,
              discountAmount: applied.discountAmount ?? 0,
              freeShipping: applied.freeShipping ?? false,
            });
          }
        } catch {
          // קופון שלא נטען לא אמור לחסום את כל תהליך הקופה — ניתן עדיין
          // להזין אותו ידנית בבלוק הסקירה
        }
      }
      void recordCommerceEvent('checkout_started', {
        sessionKey: cart.sessionKey,
        locale,
        meta: { items: items.length },
      }).catch(() => {});
    } catch {
      setBootstrapError(true);
    }
    // items נבדק בכניסה בלבד — ה-session כבר מחזיק את הצילום
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, locale]);

  useEffect(() => {
    if (started.current || !cart || items.length === 0) return;
    started.current = true;
    void runBootstrap();
  }, [cart, items.length, runBootstrap]);

  const submitContact = useCallback(
    async (values: ContactValues) => {
      const result = await saveContact(values);
      if (result.ok) {
        setContactDone(true);
        setOpenBlock('fulfillment');
        void recordCommerceEvent('contact_submitted', { sessionKey: cart?.sessionKey ?? '', locale }).catch(() => {});
      }
      return result;
    },
    [cart?.sessionKey, locale],
  );

  const submitFulfillment = useCallback(
    async (values: FulfillmentValues, selected: MethodOption) => {
      const result = await saveFulfillment(values);
      if (result.ok) {
        setMethod(selected);
        setFulfillmentDone(true);
        setOpenBlock('review');
        void recordCommerceEvent(selected.isPickup ? 'pickup_selected' : 'shipping_selected', {
          sessionKey: cart?.sessionKey ?? '',
          locale,
        }).catch(() => {});
      }
      return result;
    },
    [cart?.sessionKey, locale],
  );

  const shippingShown =
    method && !method.isPickup ? (coupon?.freeShipping ? 0 : method.price) : 0;
  // [1.3] מבצע אוטומטי — נכלל בסכום כשאין קופון או כשהמבצע צביר
  const promo = bootstrap?.promotion ?? null;
  const promoDiscount = promo && (!coupon || promo.combinableWithCoupon) ? promo.discountAmount : 0;
  const displayedTotal = Math.max(
    (bootstrap?.cart?.subtotal ?? 0) + shippingShown - (coupon?.discountAmount ?? 0) - promoDiscount,
    0,
  );
  const totalToShow = serverTotal ?? displayedTotal;
  // [1.6] שורת מע"מ בסיכום (ח.10) — אינפורמטיבי בלבד: המחיר המוצג כבר כולל
  // אותו (vat_mode=included), אותו נוסחה בדיוק כמו computeTotals בשרת
  const vatRate = bootstrap?.vatRate ?? 0;
  const vatAmount = vatRate > 0 ? round2((totalToShow * vatRate) / (100 + vatRate)) : 0;

  const handleApplyCoupon = useCallback(async (code: string) => {
    const result = await applyCoupon(code);
    if (result.ok && result.code) {
      setCoupon({
        code: result.code,
        discountAmount: result.discountAmount ?? 0,
        freeShipping: result.freeShipping ?? false,
      });
      setServerTotal(null);
      void recordCommerceEvent('coupon_applied', { sessionKey: cart?.sessionKey ?? '', locale }).catch(() => {});
    }
    return result;
  }, [cart?.sessionKey, locale]);

  const handleRemoveCoupon = useCallback(async () => {
    await removeCoupon();
    setCoupon(null);
    setServerTotal(null);
  }, []);

  const submitOrder = useCallback(
    async (extras: ExtrasValues) => {
      if (placing) return;
      setPlacing(true);
      setPlaceError(null);
      try {
        const extrasResult = await saveExtras(extras);
        if (!extrasResult.ok) {
          setPlaceError(extrasResult.fieldErrors?.terms ? t('errTerms') : t('errServer'));
          return;
        }
        void recordCommerceEvent('payment_started', { sessionKey: cart?.sessionKey ?? '', locale }).catch(() => {});
        const result = await placeOrder({ displayedTotal: serverTotal ?? displayedTotal });
        if (!result.ok) {
          if (result.error === 'total_changed' && result.serverTotal != null) {
            setServerTotal(result.serverTotal);
            setPlaceError(t('errTotalChanged', { total: formatPrice(result.serverTotal, locale) }));
          } else if (result.error === 'total_changed') {
            // הקופון פג בין הסקירה לתשלום — אין סכום שרת חדש להציג, רק לבקש רענון
            setPlaceError(t('errCouponExpired'));
          } else if (result.error === 'insufficient_stock') {
            setPlaceError(t('errInsufficientStock'));
          } else if (result.error === 'unavailable') {
            setPlaceError(t('errUnavailable'));
          } else if (result.error === 'rate_limited') {
            setPlaceError(t('errRateLimited'));
          } else if (result.error === 'terms') {
            setPlaceError(t('errTerms'));
          } else {
            setPlaceError(t('errServer'));
          }
          return;
        }
        // הסל נשאר עד שהתשלום מאושר בפועל (ResultClient) — כשל/נטישה בדף
        // הסליקה חוזרים ל-/checkout עם אותה עגלה, אותה session ואפשרות
        // ניסיון חוזר, במקום "הסל ריק בינתיים".
        if (result.mode === 'redirect_to_payment' && result.redirectUrl) {
          redirectingRef.current = true;
          setRedirecting(true);
          window.location.assign(result.redirectUrl);
          return;
        }
        if (result.error === 'payment_error') {
          // ההזמנה נוצרה אך פתיחת דף התשלום נכשלה — לא הצלחה, ניסיון חוזר זמין
          setPlaceError(t('errPaymentPage'));
          return;
        }
        router.push('/checkout/result?outcome=created');
      } catch {
        // [1.4] כשל רשת אמיתי (throw, לא {ok:false}) היה משאיר את הכפתור
        // חוזר לפעיל בלי שום הודעה — הלקוח לא יודע אם ההזמנה בוצעה או לא
        setPlaceError(t('errServer'));
      } finally {
        // בזמן ניווט אמיתי אל דף התשלום אין לשחרר את הכפתור — הוא ייעלם
        // מהמסך תוך רגע, ו"חוזר לפעיל" שקרי בטעות ניתן ללחיצה כפולה
        if (!redirectingRef.current) setPlacing(false);
      }
    },
    [placing, displayedTotal, serverTotal, cart, router, t, locale],
  );

  if (redirecting) {
    return (
      <div role="status" aria-live="polite" className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-burgundy border-t-transparent motion-reduce:animate-none" />
        <p className="text-lead text-ink">{t('redirectingToPayment')}</p>
      </div>
    );
  }

  if (!cart?.enabled) {
    return <p className="py-16 text-center text-muted">{t('disabled')}</p>;
  }
  if (items.length === 0 && !placing && bootstrap === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-lead text-muted">{t('cartEmpty')}</p>
        <Link href="/books" className="btn btn-quiet">
          {t('cartEmptyCta')}
        </Link>
      </div>
    );
  }
  if (bootstrapError) {
    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <p className="text-lead text-muted">{t('errBootstrap')}</p>
        <button
          type="button"
          onClick={() => {
            started.current = true;
            void runBootstrap();
          }}
          className="btn btn-solid"
        >
          {t('errRetry')}
        </button>
      </div>
    );
  }
  if (!bootstrap) {
    return (
      <div aria-hidden="true" className="mx-auto mt-10 max-w-2xl space-y-4">
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-cream-2" />
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-cream-2" />
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-cream-2" />
      </div>
    );
  }
  if (!bootstrap.ok || !bootstrap.cart) {
    return <p className="py-16 text-center text-muted">{t('errServer')}</p>;
  }

  const summary = bootstrap.cart;

  return (
    <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-5">
        <p className="text-small text-muted">
          <Link href="/cart" className="hover:text-burgundy">
            ← {t('backToCart')}
          </Link>
        </p>

        {bootstrap.expressEnabled ? (
          <ExpressStrip
            selected={wallet}
            onSelect={(chosen) => {
              // הבחירה נרשמת על ה-session; דף מורנינג ייפתח עם האמצעי הזה
              setWallet(chosen);
              void startCheckout(items, locale, { wallet: chosen });
            }}
          />
        ) : null}

        <ol className="rail">
          <ContactBlock
            open={openBlock === 'contact'}
            done={contactDone}
            initial={{
              phone: bootstrap.session?.contact_phone ?? '',
              name: bootstrap.session?.contact_name ?? '',
              email: bootstrap.session?.contact_email ?? '',
            }}
            supportPhone={bootstrap.supportPhone}
            onOpen={() => setOpenBlock('contact')}
            onSubmit={submitContact}
          />

          <FulfillmentBlock
            open={openBlock === 'fulfillment'}
            done={fulfillmentDone}
            reachable={contactDone}
            methods={bootstrap.methods}
            pickup={bootstrap.pickup}
            initialMethodId={bootstrap.session?.fulfillment?.method_id ?? null}
            initialAddress={bootstrap.session?.fulfillment?.address ?? {}}
            onOpen={() => contactDone && setOpenBlock('fulfillment')}
            onSubmit={submitFulfillment}
          />

          <ReviewBlock
            open={openBlock === 'review'}
            reachable={contactDone && fulfillmentDone}
            paymentsEnabled={bootstrap.paymentsEnabled}
            couponsEnabled={bootstrap.couponsEnabled}
            coupon={coupon}
            onApplyCoupon={handleApplyCoupon}
            onRemoveCoupon={handleRemoveCoupon}
            installments={bootstrap.installments}
            supportPhone={bootstrap.supportPhone}
            total={totalToShow}
            initial={{
              isGift: bootstrap.session?.is_gift ?? false,
              giftRecipientName: bootstrap.session?.gift_recipient_name ?? '',
              giftMessage: bootstrap.session?.gift_message ?? '',
              giftHidePrices: bootstrap.session?.gift_hide_prices ?? true,
              notifyChannel: bootstrap.session?.notify_channel ?? null,
            }}
            placing={placing}
            placeError={placeError}
            onOpen={() => contactDone && fulfillmentDone && setOpenBlock('review')}
            onSubmit={submitOrder}
          />
        </ol>
      </div>

      {/* סיכום דביק; במובייל יורד מתחת לבלוקים ומתקפל (ח.11) */}
      <aside className="order-first lg:order-none lg:sticky lg:top-28 rounded-[var(--radius-lg)] border border-rule bg-cream px-6 py-5 shadow-[var(--shadow-soft)]">
        <button
          type="button"
          onClick={() => setSummaryExpanded((v) => !v)}
          aria-expanded={summaryExpanded}
          aria-controls="checkout-summary-details"
          className="flex w-full items-center justify-between gap-3 lg:pointer-events-none lg:cursor-default"
        >
          <h2 className="font-serif text-h3 text-ink">{t('summaryTitle')}</h2>
          <span className="flex items-center gap-2 lg:hidden">
            <strong className="font-serif text-h3 tabular-nums text-ink">
              {formatPrice(totalToShow, locale)}
            </strong>
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className={`h-4 w-4 text-muted transition-transform duration-200 ${summaryExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            >
              <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <div id="checkout-summary-details" className={`${summaryExpanded ? 'block' : 'hidden'} lg:block`}>
          <ul className="mt-3 space-y-2 text-small text-ink-soft">
            {summary.lines
              .filter((line) => line.removedReason === null)
              .map((line) => (
                <li key={line.bookId} className="flex items-center gap-3">
                  <div className="w-10 shrink-0">
                    <BookCover src={line.coverImageUrl} title={line.title} alt="" sizes="40px" />
                  </div>
                  <span className="line-clamp-1 flex-1">
                    {line.title} ×{line.quantity}
                  </span>
                  <span className="tabular-nums">{formatPrice(line.lineTotal, locale)}</span>
                </li>
              ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-rule pt-3 text-small">
            <div className="flex justify-between text-ink-soft">
              <dt>{t('subtotal')}</dt>
              <dd className="tabular-nums">{formatPrice(summary.subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between text-ink-soft">
              <dt>{t('shipping')}</dt>
              <dd className="tabular-nums">
                {method ? (shippingShown === 0 ? t('free') : formatPrice(shippingShown, locale)) : '—'}
              </dd>
            </div>
            {coupon && coupon.discountAmount > 0 ? (
              <div className="flex justify-between text-ink-soft">
                <dt>
                  {t('discount')} · <span dir="ltr">{coupon.code}</span>
                </dt>
                <dd className="tabular-nums">− {formatPrice(coupon.discountAmount, locale)}</dd>
              </div>
            ) : null}
            {promoDiscount > 0 && promo ? (
              <div className="flex justify-between text-gold-deep">
                <dt>
                  {t('promotionLabel')} · {promo.name}
                </dt>
                <dd className="tabular-nums">− {formatPrice(promoDiscount, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-rule pt-2 text-ink">
              <dt className="font-semibold">{t('total')}</dt>
              <dd className="font-serif text-h3 tabular-nums">{formatPrice(totalToShow, locale)}</dd>
            </div>
          </dl>
          {vatAmount > 0 ? (
            <p className="mt-1.5 text-caption text-muted">
              {t('vatIncluded', { amount: formatPrice(vatAmount, locale) })}
            </p>
          ) : null}
          {method ? (
            <p className="mt-3 text-caption text-muted">
              {t('deliveryEstimate', { date: method.promisedDateLabel })}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
