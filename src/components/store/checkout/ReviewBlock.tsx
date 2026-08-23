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
  const tPages = useTranslations('pages');
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

  const inputCls =
    'w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60';

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

  // חולץ מה-handler של הכפתור כדי ששדה הקופון יוכל לקרוא לו גם מ-Enter:
  // בלי זה Enter בשדה הפעיל את ה-submit של הטופס כולו — כלומר *ביצע את
  // ההזמנה* במקום להחיל קופון (implicit submission מפעיל את כפתור
  // ה-submit הראשון, שהוא כפתור התשלום).
  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const result = await onApplyCoupon(code);
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
  }

  return (
    <BlockShell
      index={3}
      title={t('reviewTitle')}
      open={open}
      done={false}
      reachable={reachable}
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
                    onKeyDown={(e) => {
                      // Enter מחיל את הקופון — לא שולח את ההזמנה
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void applyCoupon();
                      }
                    }}
                    aria-invalid={couponError ? true : undefined}
                    aria-describedby={couponError ? 'coupon-error' : undefined}
                    className={inputCls}
                  />
                </div>
                <button
                  type="button"
                  disabled={couponBusy || !couponInput.trim()}
                  onClick={() => void applyCoupon()}
                  className="btn btn-quiet"
                >
                  {couponBusy ? t('couponChecking') : t('couponApply')}
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
          <label className="flex cursor-pointer items-center gap-2.5 text-small text-ink">
            <input
              type="checkbox"
              checked={isGift}
              onChange={(e) => setIsGift(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-burgundy)]"
            />
            {t('giftToggle')}
          </label>
          {isGift ? (
            <div className="mt-3 space-y-4 rounded-[var(--radius-md)] bg-cream-2/60 px-4 py-4">
              <Field
                id="gift-recipient"
                label={t('giftRecipientName')}
                input={
                  <input id="gift-recipient" type="text" value={giftRecipientName} onChange={(e) => setGiftRecipientName(e.target.value)} className={inputCls} />
                }
              />
              <Field
                id="gift-message"
                label={t('giftMessage')}
                input={
                  <textarea id="gift-message" rows={3} maxLength={300} value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} className={inputCls} />
                }
              />
              <label className="flex cursor-pointer items-center gap-2.5 text-small text-ink">
                <input
                  type="checkbox"
                  checked={giftHidePrices}
                  onChange={(e) => setGiftHidePrices(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-burgundy)]"
                />
                {t('giftHidePrices')}
              </label>
              <p className="text-caption text-muted">{t('giftDocNote')}</p>
            </div>
          ) : null}
        </div>

        {/* ערוץ נייד — ריק כברירת מחדל, בחירה יזומה. radio ולא checkbox:
            הערוצים חלופיים (בחירת אחד ביטלה בשקט את השני), ותיבת סימון
            מבטיחה "אפשר לבחור כמה" — גם ויזואלית וגם לקורא מסך. */}
        <fieldset>
          <legend className="text-small font-semibold text-ink">{t('notifyPrompt')}</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-small text-ink-soft">
              <input
                type="radio"
                name="notify-channel"
                checked={notifyChannel === null}
                onChange={() => setNotifyChannel(null)}
                className="h-4 w-4 accent-[var(--color-burgundy)]"
              />
              {t('notifyNone')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-small text-ink-soft">
              <input
                type="radio"
                name="notify-channel"
                checked={notifyChannel === 'sms'}
                onChange={() => setNotifyChannel('sms')}
                className="h-4 w-4 accent-[var(--color-burgundy)]"
              />
              {t('notifySms')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-small text-ink-soft">
              <input
                type="radio"
                name="notify-channel"
                checked={notifyChannel === 'whatsapp'}
                onChange={() => setNotifyChannel('whatsapp')}
                className="h-4 w-4 accent-[var(--color-burgundy)]"
              />
              {t('notifyWhatsapp')}
            </label>
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
              className="mt-0.5 h-4 w-4 accent-[var(--color-burgundy)]"
            />
            <span>
              {t('termsPrefix')}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-burgundy"
              >
                {t('termsLink')}
                <span className="sr-only"> {t('opensInNewTab')}</span>
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
          <p
            role="alert"
            tabIndex={-1}
            // המיקוד והגלילה אל השגיאה: אחרי לחיצת תשלום במובייל הכפתור
            // בתחתית המסך וההודעה מופיעה מעליו — לעיתים מחוץ לתצוגה.
            ref={(node) => {
              node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              node?.focus({ preventScroll: true });
            }}
            className="rounded-[var(--radius-md)] border border-burgundy/40 bg-burgundy/5 px-4 py-3 text-small text-burgundy"
          >
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
          {paymentsEnabled ? (
            <p className="flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none">
                <rect x="4" y="8.5" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M7 8.5V6.6a3 3 0 0 1 6 0v1.9" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              {t('trustLine')}
            </p>
          ) : (
            <p>{t('noPaymentNote')}</p>
          )}
          {supportPhone ? <p>{t('phoneHelp', { phone: supportPhone })}</p> : null}
          {/* הפוטר מוסתר בקופה — קישורי החובה המשפטיים חייבים דרך אחרת */}
          <p className="flex flex-wrap gap-x-3 pt-1">
            <Link href="/terms" className="underline underline-offset-2 hover:text-burgundy">
              {tPages('terms')}
            </Link>
            <Link href="/privacy" className="underline underline-offset-2 hover:text-burgundy">
              {tPages('privacy')}
            </Link>
            <Link href="/accessibility" className="underline underline-offset-2 hover:text-burgundy">
              {tPages('accessibility')}
            </Link>
          </p>
        </div>
      </form>
    </BlockShell>
  );
}
