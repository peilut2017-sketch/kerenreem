'use client';
import { AddressAutocomplete } from '../AddressAutocomplete';
import { searchCities, searchStreets } from '@/lib/commerce/address-actions';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatPrice } from '@/lib/commerce/pricing';
import { BlockShell } from './BlockShell';
import { Field } from './ContactBlock';
import type { ActionResult, MethodOption } from '@/lib/commerce/checkout-actions';
import type { ShippingAddress } from '@/lib/supabase/types';

/**
 * בלוק 2 — אספקה (פרק 7.1): משלוח ואיסוף עצמי כשתי אפשרויות שוות-ערך,
 * מחיר ותאריך לכל שיטה, כתובת במבנה ישראלי מלא, הערות לשליח.
 */

export interface FulfillmentValues {
  methodId: string;
  isPickup: boolean;
  address?: Partial<ShippingAddress>;
  courierNotes?: string;
}

export function FulfillmentBlock({
  open,
  done,
  reachable,
  methods,
  pickup,
  initialMethodId,
  initialAddress,
  onOpen,
  onSubmit,
}: {
  open: boolean;
  done: boolean;
  reachable: boolean;
  methods: MethodOption[];
  pickup: { address: Record<string, string>; hours: string | null } | null;
  initialMethodId: string | null;
  initialAddress: Partial<ShippingAddress>;
  onOpen: () => void;
  onSubmit: (values: FulfillmentValues, method: MethodOption) => Promise<ActionResult>;
}) {
  const t = useTranslations('store');
  const locale = useLocale();
  const [methodId, setMethodId] = useState<string | null>(initialMethodId ?? methods[0]?.id ?? null);
  const [address, setAddress] = useState<Partial<ShippingAddress>>(initialAddress);
  const [courierNotes, setCourierNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(false);

  const selected = methods.find((m) => m.id === methodId) ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setFormError(false);
    try {
      const result = await onSubmit(
        {
          methodId: selected.id,
          isPickup: selected.isPickup,
          address: selected.isPickup ? undefined : address,
          courierNotes: courierNotes || undefined,
        },
        selected,
      );
      setErrors(
        result.fieldErrors
          ? Object.fromEntries(
              Object.entries(result.fieldErrors).map(([key]) => [key, t('errRequired')]),
            )
          : {},
      );
    } catch {
      // [1.4] היה בלי catch — כשל רשת לא הציג שום הודעה, רק שחרר את הכפתור
      setFormError(true);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [key]: e.target.value }));

  const inputCls =
    'w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60';

  return (
    <BlockShell
      index={2}
      title={t('fulfillmentTitle')}
      open={open}
      done={done}
      reachable={reachable}
      onOpen={onOpen}
      summary={
        done && selected
          ? `${selected.name} · ${selected.price === 0 ? t('free') : formatPrice(selected.price, locale)}`
          : undefined
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <fieldset>
          <legend className="sr-only">{t('fulfillmentTitle')}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((method) => (
              <label
                key={method.id}
                className={`flex cursor-pointer flex-col gap-1 rounded-[var(--radius-md)] border px-4 py-3 transition-colors ${
                  methodId === method.id ? 'border-gold bg-gold/10' : 'border-rule bg-white/50'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-small font-semibold text-ink">
                    <input
                      type="radio"
                      name="shipping-method"
                      checked={methodId === method.id}
                      onChange={() => setMethodId(method.id)}
                      className="accent-[var(--color-burgundy)]"
                    />
                    {method.name}
                  </span>
                  <span className="text-small text-ink tabular-nums">
                    {method.price === 0 ? t('free') : formatPrice(method.price, locale)}
                  </span>
                </span>
                <span className="ps-6 text-caption text-muted">
                  {t('deliveryEstimate', { date: method.promisedDateLabel })}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {selected?.isPickup ? (
          <div className="rounded-[var(--radius-md)] bg-cream-2/70 px-4 py-3 text-small text-ink-soft">
            {pickup?.address && Object.keys(pickup.address).length > 0 ? (
              <p>
                <strong>{t('pickupAddressTitle')}:</strong>{' '}
                {Object.values(pickup.address).filter(Boolean).join(', ')}
              </p>
            ) : null}
            {pickup?.hours ? (
              <p className="mt-1">
                <strong>{t('pickupHoursTitle')}:</strong> {pickup.hours}
              </p>
            ) : null}
            <p className="mt-1">{t('pickupReadyNote')}</p>
          </div>
        ) : selected ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="addr-recipient"
                label={t('recipientName')}
                error={errors.recipient_name}
                input={
                  <input id="addr-recipient" type="text" autoComplete="shipping name" required value={address.recipient_name ?? ''} onChange={set('recipient_name')} aria-invalid={errors.recipient_name ? true : undefined} className={inputCls} />
                }
              />
              <Field
                id="addr-phone"
                label={t('recipientPhone')}
                input={
                  <input id="addr-phone" type="tel" dir="ltr" autoComplete="shipping tel" value={address.phone ?? ''} onChange={set('phone')} className={inputCls} />
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
              <Field
                id="addr-city"
                label={t('city')}
                error={errors.city}
                input={
                  <AddressAutocomplete id="addr-city" autoComplete="shipping address-level2" required value={address.city ?? ''} onChange={(next) => setAddress((v) => ({ ...v, city: next }))} fetcher={searchCities} invalid={Boolean(errors.city)} className={inputCls} />
                }
              />
              <Field
                id="addr-street"
                label={t('street')}
                error={errors.street}
                input={
                  <AddressAutocomplete id="addr-street" autoComplete="shipping address-line1" required value={address.street ?? ''} onChange={(next) => setAddress((v) => ({ ...v, street: next }))} fetcher={(q) => searchStreets(address.city ?? '', q)} invalid={Boolean(errors.street)} className={inputCls} />
                }
              />
              <Field
                id="addr-house"
                label={t('houseNumber')}
                error={errors.house_number}
                input={
                  <input id="addr-house" type="text" inputMode="numeric" required value={address.house_number ?? ''} onChange={set('house_number')} aria-invalid={errors.house_number ? true : undefined} className={inputCls} />
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field id="addr-entrance" label={t('entrance')} input={<input id="addr-entrance" type="text" value={address.entrance ?? ''} onChange={set('entrance')} className={inputCls} />} />
              <Field id="addr-floor" label={t('floor')} input={<input id="addr-floor" type="text" inputMode="numeric" value={address.floor ?? ''} onChange={set('floor')} className={inputCls} />} />
              <Field id="addr-apartment" label={t('apartment')} input={<input id="addr-apartment" type="text" inputMode="numeric" value={address.apartment ?? ''} onChange={set('apartment')} className={inputCls} />} />
              <Field
                id="addr-zip"
                label={t('zip')}
                error={errors.zip}
                input={
                  <input id="addr-zip" type="text" dir="ltr" inputMode="numeric" autoComplete="shipping postal-code" value={address.zip ?? ''} onChange={set('zip')} aria-invalid={errors.zip ? true : undefined} className={inputCls} />
                }
              />
            </div>
            <Field
              id="addr-notes"
              label={t('courierNotes')}
              input={
                <input id="addr-notes" type="text" value={courierNotes} onChange={(e) => setCourierNotes(e.target.value)} className={inputCls} />
              }
            />
          </div>
        ) : null}

        {formError ? (
          <p role="alert" className="text-caption text-burgundy">
            {t('errServer')}
          </p>
        ) : null}

        <button type="submit" disabled={busy || !selected} className="btn btn-solid">
          {t('continueButton')}
        </button>
      </form>
    </BlockShell>
  );
}
