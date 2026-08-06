'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { formatPrice } from '@/lib/commerce/pricing';
import {
  placeOrder,
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
  const [openBlock, setOpenBlock] = useState<BlockId>('contact');
  const [contactDone, setContactDone] = useState(false);
  const [fulfillmentDone, setFulfillmentDone] = useState(false);
  const [method, setMethod] = useState<MethodOption | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const started = useRef(false);

  const items = cart?.items ?? [];

  useEffect(() => {
    if (started.current || !cart || items.length === 0) return;
    started.current = true;
    void (async () => {
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
      void recordCommerceEvent('checkout_started', {
        sessionKey: cart.sessionKey,
        locale,
        meta: { items: items.length },
      });
    })();
    // items נבדק בכניסה בלבד — ה-session כבר מחזיק את הצילום
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, locale]);

  const submitContact = useCallback(
    async (values: ContactValues) => {
      const result = await saveContact(values);
      if (result.ok) {
        setContactDone(true);
        setOpenBlock('fulfillment');
        void recordCommerceEvent('contact_submitted', { sessionKey: cart?.sessionKey ?? '', locale });
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
        });
      }
      return result;
    },
    [cart?.sessionKey, locale],
  );

  const displayedTotal =
    (bootstrap?.cart?.subtotal ?? 0) + (method && !method.isPickup ? method.price : 0);

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
        void recordCommerceEvent('payment_started', { sessionKey: cart?.sessionKey ?? '', locale });
        const result = await placeOrder({ displayedTotal: serverTotal ?? displayedTotal });
        if (!result.ok) {
          if (result.error === 'total_changed' && result.serverTotal != null) {
            setServerTotal(result.serverTotal);
            setPlaceError(t('errTotalChanged', { total: formatPrice(result.serverTotal, locale) }));
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
        cart?.clear();
        if (result.mode === 'redirect_to_payment' && result.redirectUrl) {
          window.location.assign(result.redirectUrl);
          return;
        }
        router.push('/checkout/result?outcome=created');
      } finally {
        setPlacing(false);
      }
    },
    [placing, displayedTotal, serverTotal, cart, router, t, locale],
  );

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
      <div className="space-y-4">
        <p className="text-small text-muted">
          <Link href="/cart" className="hover:text-burgundy">
            ← {t('backToCart')}
          </Link>
        </p>

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
          installments={bootstrap.installments}
          supportPhone={bootstrap.supportPhone}
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
      </div>

      {/* סיכום דביק; במובייל יורד מתחת לבלוקים */}
      <aside className="order-first lg:order-none lg:sticky lg:top-28 rounded-[var(--radius-lg)] border border-rule bg-cream px-6 py-5 shadow-[var(--shadow-soft)]">
        <h2 className="font-serif text-h3 text-ink">{t('summaryTitle')}</h2>
        <ul className="mt-3 space-y-2 text-small text-ink-soft">
          {summary.lines
            .filter((line) => line.removedReason === null)
            .map((line) => (
              <li key={line.bookId} className="flex justify-between gap-3">
                <span className="line-clamp-1">
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
              {method ? (method.price === 0 ? t('free') : formatPrice(method.price, locale)) : '—'}
            </dd>
          </div>
          <div className="flex justify-between border-t border-rule pt-2 text-ink">
            <dt className="font-semibold">{t('total')}</dt>
            <dd className="font-serif text-h3 tabular-nums">
              {formatPrice(serverTotal ?? displayedTotal, locale)}
            </dd>
          </div>
        </dl>
        {method ? (
          <p className="mt-3 text-caption text-muted">
            {t('deliveryEstimate', { date: method.promisedDateLabel })}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
