'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatPrice } from '@/lib/commerce/pricing';
import { BlockShell } from './BlockShell';
import { Field } from './ContactBlock';
import type { CouponActionResult } from '@/lib/commerce/checkout-actions';

/**
 * בלוק 3 — מתנה, ערוץ נייד, תקנון ותשלום (פרק 7.1). חבילת האמון כולה
 * כאן: תמצית הביטול ליד הכפתור, שורת מורנינג, והטלפון האנושי. תיבת
 * הערוץ הנייד ריקה כברירת מחדל (החלטה 23) — בחירה יזומה בלבד.
 */

export interface ExtrasValues {
  isGift: boolean;
  giftRecipientName?: string;
  giftMessage?: string;
  giftHidePrices?: boolean;
  notifyChannel?: 'sms' | 'whatsapp' | null;
  termsAccepted: boolean;
}

export function ReviewBlock({
  open,
  reachable,
  paymentsEnabled,
  couponsEnabled,
  coupon,
  onApplyCoupon,
  onRemoveCoupon,
  installments,
  supportPhone,
  total,
  initial,
  placing,
  placeError,
  onOpen,
  onSubmit,
}: {
  open: boolean;
  reachable: boolean;
  paymentsEnabled: boolean;
  couponsEnabled: boolean;
  coupon: { code: string; discountAmount: number; freeShipping: boolean } | null;
  onApplyCoupon: (code: string) => Promise<CouponActionResult>;
  onRemoveCoupon: () => Promise<void>;
  installments: { minTotal: number; max: number } | null;
  supportPhone: string | null;
  /** [1.6] הסכום המחייב הנוכחי — לתצוגה על כפתור התשלום עצמו (ח.9) */
  total: number;
  initial: {
    isGift: boolean;
    giftRecipientName: string;
    giftMessage: string;
    giftHidePrices: boolean;
    notifyChannel: 'sms' | 'whatsapp' | null;
  };
  placing: boolean;
  placeError: string | null;
  onOpen: () => void;
  onSubmit: (extras: ExtrasValues) => Promise<void>;
}) {
  const t = useTranslations('store');
  const locale = useLocale();
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponRemoving, setCouponRemoving] = useState(false);
  const [isGift, setIsGift] = useState(initial.isGift);
  const [giftRecipientName, setGiftRecipientName] = useState(initial.giftRecipientName);
  const [giftMessage, setGiftMessage] = useState(initial.giftMessage);
  const [giftHidePrices, setGiftHidePrices] = useState(initial.giftHidePrices);
  const [notifyChannel, setNotifyChannel] = useState<'sms' | 'whatsapp' | null>(
    initial.notifyChannel,
  );
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!termsAccepted) {
      setTermsError(true);
      return;
    }
    setTermsError(false);
    await onSubmit({
      isGift,
      giftRecipientName: isGift ? giftRecipientName : undefined,
      giftMessage: isGift ? giftMessage : undefined,
      giftHidePrices,
      notifyChannel,
      termsAccepted,
    });
  }

  return (
    <BlockShell
      index={3}
      title={t('reviewTitle')}
      open={open}
      done={false}
      reachable={reachable}
      isLast
      onOpen={onOpen}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* קופון — progressive disclosure, אימות שרת בלבד */}
        {couponsEnabled ? (
          <div>
            {coupon ? (
              <p className="flex flex-wrap items-center gap-2 text-small text-ink">
                <span className="rounded-[var(--radius-pill)] bg-gold/15 px-3 py-1">
                  {t('couponApplied', {
                    code: coupon.code,
                    amount: coupon.freeShipping && coupon.discountAmount === 0
                      ? t('free')
                      : formatPrice(coupon.discountAmount, locale),
                  })}
                </span>
                <button
                  type="button"
                  disabled={couponRemoving}
                  onClick={async () => {
                    setCouponRemoving(true);
                    try {
                      await onRemoveCoupon();
                    } catch {
                      // [1.4] היה בלי טיפול שגיאה בכלל — כשל רשת נראה כלחיצה שלא עשתה כלום
                      setCouponError(t('errServer'));
                    } finally {
                      setCouponRemoving(false);
                    }
                  }}
                  className="text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline disabled:opacity-50"
                >
                  {t('couponRemove')}
                </button>
              </p>
            ) : !couponOpen && !couponError ? (
              <button
                type="button"
                onClick={() => setCouponOpen(true)}
                className="text-small text-muted underline-offset-2 hover:text-burgundy hover:underline"
              >
                {t('couponHave')}
              </button>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-40">
                  <label htmlFor="coupon-code" className="mb-1.5 block text-small font-semibold text-ink">
                    {t('coupon')}
                  </label>
                  <input
                    id="coupon-code"
                    type="text"
                    dir="ltr"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    aria-invalid={couponError ? true : undefined}
                    aria-describedby={couponError ? 'coupon-error' : undefined}
                    className="commerce-field"
                  />
                </div>
                <button
                  type="button"
                  disabled={couponBusy || !couponInput.trim()}
                  onClick={async () => {
                    setCouponBusy(true);
                    setCouponError(null);
                    try {
                      const result = await onApplyCoupon(couponInput.trim());
                      if (!result.ok) {
                        setCouponError(
                          result.error === 'min_total' && result.minTotal != null
                            ? t('couponErrMinTotal', { amount: formatPrice(result.minTotal, locale) })
                            : result.error === 'used_up'
                              ? t('couponErrUsedUp')
                              : result.error === 'not_applicable'
                                ? t('couponErrNotApplicable')
                                : result.error === 'not_combinable'
                                  ? t('couponErrNotCombinable')
                                  : t('couponErrInvalid'),
                        );
                      } else {
                        setCouponInput('');
                      }
                    } catch {
                      // [1.4] היה בלי catch — כשל רשת נשאר בלי שום הודעה למרות ש-couponBusy מתאפס
                      setCouponError(t('errServer'));
                    } finally {
                      setCouponBusy(false);
                    }
                  }}
                  className="btn btn-quiet"
                >
                  {t('couponApply')}
                </button>
                {couponError ? (
                  <p id="coupon-error" role="alert" className="w-full text-caption text-burgundy">
                    {couponError}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {/* מתנה — progressive disclosure */}
        <div>
          <label className="flex cursor-pointer items-center gap-3 text-small font-semibold text-ink">
            <span className="switch">
              <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
              <span className="switch-thumb" aria-hidden="true" />
            </span>
            {t('giftToggle')}
          </label>
          {isGift ? (
            <div className="mt-3 space-y-4 rounded-[var(--radius-md)] bg-cream-2/60 px-4 py-4">
              <Field
                id="gift-recipient"
                label={t('giftRecipientName')}
                input={
                  <input id="gift-recipient" type="text" value={giftRecipientName} onChange={(e) => setGiftRecipientName(e.target.value)} className="commerce-field" />
                }
              />
              <Field
                id="gift-message"
                label={t('giftMessage')}
                input={
                  <textarea id="gift-message" rows={3} maxLength={300} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} className="commerce-field" />
                }
              />
              <label className="flex cursor-pointer items-center gap-2.5 text-small text-ink">
                <input
                  type="checkbox"
                  checked={giftHidePrices}
                  onChange={(e) => setGiftHidePrices(e.target.checked)}
                />
                {t('giftHidePrices')}
              </label>
              <p className="text-caption text-muted">{t('giftDocNote')}</p>
            </div>
          ) : null}
        </div>

        {/* ערוץ נייד — ריק כברירת מחדל, בחירה יזומה; זוג צ'יפים בררים
            (לא checkbox זוגי) כי הבחירה יחידה עם אפשרות ביטול */}
        <fieldset>
          <legend className="text-small font-semibold text-ink">{t('notifyPrompt')}</legend>
          <div className="seg-toggle-group mt-2">
            <button
              type="button"
              aria-pressed={notifyChannel === 'sms'}
              onClick={() => setNotifyChannel(notifyChannel === 'sms' ? null : 'sms')}
              className="seg-toggle"
            >
              {t('notifySms')}
            </button>
            <button
              type="button"
              aria-pressed={notifyChannel === 'whatsapp'}
              onClick={() => setNotifyChannel(notifyChannel === 'whatsapp' ? null : 'whatsapp')}
              className="seg-toggle"
            >
              {t('notifyWhatsapp')}
            </button>
          </div>
        </fieldset>

        {installments ? (
          <p className="text-caption text-muted">{t('installmentsNote', { n: installments.max })}</p>
        ) : null}

        {/* תקנון + תמצית ביטול — ליד הכפתור, כדרישת פרק 3.5 */}
        <div>
          <label className="flex cursor-pointer items-start gap-2.5 text-small text-ink">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              aria-invalid={termsError ? true : undefined}
              aria-describedby={termsError ? 'terms-error' : undefined}
              className="mt-0.5"
            />
            <span>
              {t('termsPrefix')}
              <Link href="/terms" target="_blank" className="underline underline-offset-2 hover:text-burgundy">
                {t('termsLink')}
              </Link>
            </span>
          </label>
          {termsError ? (
            <p id="terms-error" role="alert" className="mt-1 text-caption text-burgundy">
              {t('errTerms')}
            </p>
          ) : null}
          <p className="mt-2 text-caption text-muted">{t('cancelPolicyBrief')}</p>
        </div>

        {placeError ? (
          <p role="alert" className="rounded-[var(--radius-md)] border border-burgundy/40 bg-burgundy/5 px-4 py-3 text-small text-burgundy">
            {placeError}
          </p>
        ) : null}

        <button type="submit" disabled={placing} className="btn btn-solid w-full sm:w-auto">
          {placing
            ? t('processingOrder')
            : paymentsEnabled
              ? t('payButtonAmount', { amount: formatPrice(total, locale) })
              : t('submitNoPaymentAmount', { amount: formatPrice(total, locale) })}
        </button>

        {/* חבילת האמון */}
        <div className="space-y-1.5 border-t border-rule pt-4 text-caption text-muted">
          {paymentsEnabled ? <p>{t('trustLine')}</p> : <p>{t('noPaymentNote')}</p>}
          {supportPhone ? <p>{t('phoneHelp', { phone: supportPhone })}</p> : null}
        </div>
      </form>
    </BlockShell>
  );
}
