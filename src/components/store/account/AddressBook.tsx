'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { AddressAutocomplete } from '@/components/store/AddressAutocomplete';
import { searchCities, searchStreets } from '@/lib/commerce/address-actions';
import {
  deleteMyAddress,
  saveMyAddress,
  type AddressInput,
} from '@/lib/commerce/account-actions';
import type { CustomerAddress } from '@/lib/supabase/types';

/**
 * [1.3] פנקס הכתובות (פרק 4.6): רשימת כרטיסים + טופס הוספה/עריכה עם
 * השלמת עיר ורחוב מול המרשם הממשלתי. כתובת ברירת המחדל ממלאת מראש את
 * ה-Checkout; מחיקה בבקשת אישור.
 */

const EMPTY: AddressInput = {
  label: '',
  recipientName: '',
  phone: '',
  city: '',
  street: '',
  houseNumber: '',
  entrance: '',
  floor: '',
  apartment: '',
  zip: '',
  isDefault: false,
};

function toForm(address: CustomerAddress): AddressInput {
  return {
    label: address.label ?? '',
    recipientName: address.recipient_name,
    phone: address.phone ?? '',
    city: address.city,
    street: address.street,
    houseNumber: address.house_number,
    entrance: address.entrance ?? '',
    floor: address.floor ?? '',
    apartment: address.apartment ?? '',
    zip: address.zip ?? '',
    isDefault: address.is_default,
  };
}

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60';

function FieldRow({ id, label, input }: { id: string; label: string; input: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-small font-semibold text-ink">
        {label}
      </label>
      {input}
    </div>
  );
}

export function AddressBook({ addresses }: { addresses: CustomerAddress[] }) {
  const t = useTranslations('store');
  const router = useRouter();
  // 'new' — טופס כתובת חדשה; מזהה — עריכת הכתובת הזו; null — רשימה בלבד
  const [editing, setEditing] = useState<'new' | string | null>(null);
  const [form, setForm] = useState<AddressInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  // [1.4] remove/makeDefault לא בדקו תוצאה ולא היה להם catch בכלל —
  // כשל (עסקי או רשת) היה חוזר ל-idle בלי שום סימן שהפעולה לא הצליחה
  const [listError, setListError] = useState(false);

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.recipientName.trim() || !form.city.trim() || !form.street.trim() || !form.houseNumber.trim()) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      const result = await saveMyAddress(editing === 'new' ? null : editing, form);
      if (!result.ok) {
        setError(true);
        return;
      }
      setEditing(null);
      setForm(EMPTY);
      setError(false);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function remove(address: CustomerAddress) {
    if (!window.confirm(t('addressDeleteConfirm'))) return;
    setBusy(true);
    setListError(false);
    try {
      const result = await deleteMyAddress(address.id);
      if (!result.ok) {
        setListError(true);
        return;
      }
      router.refresh();
    } catch {
      setListError(true);
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(address: CustomerAddress) {
    setBusy(true);
    setListError(false);
    try {
      const result = await saveMyAddress(address.id, { ...toForm(address), isDefault: true });
      if (!result.ok) {
        setListError(true);
        return;
      }
      router.refresh();
    } catch {
      setListError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {listError ? (
        <p role="alert" className="rounded-[var(--radius-md)] border border-burgundy/40 bg-burgundy/5 px-4 py-3 text-small text-burgundy">
          {t('addressActionError')}
        </p>
      ) : null}
      {addresses.length === 0 && editing === null ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-rule bg-cream px-6 py-10 text-center">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto h-8 w-8 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <p className="mt-3 text-small text-muted">{t('addressesEmpty')}</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-rule bg-cream p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-cream-2 px-3 py-1 text-caption font-semibold text-ink-soft">
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {address.label || t('addressDefaultLabel')}
                </span>
                {address.is_default ? (
                  <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-gold/15 px-3 py-1 text-caption font-semibold text-burgundy">
                    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor" stroke="none">
                      <path d="m12 2 2.9 6.26 6.6.7-4.95 4.5 1.4 6.54L12 16.77 6.05 20l1.4-6.54L2.5 8.96l6.6-.7L12 2Z" />
                    </svg>
                    {t('addressDefaultBadge')}
                  </span>
                ) : null}
              </div>
              <div className="text-small text-ink">
                <p className="font-semibold">{address.recipient_name}</p>
                <p className="mt-0.5 text-ink-soft">
                  {address.street} {address.house_number}
                  {address.apartment ? ` / ${address.apartment}` : ''}, {address.city}
                </p>
                {address.phone ? (
                  <p className="mt-0.5 text-ink-soft" dir="ltr">
                    {address.phone}
                  </p>
                ) : null}
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-rule/70 pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(address.id);
                    setForm(toForm(address));
                    setError(false);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-rule px-3 py-1.5 text-caption font-semibold text-ink transition-colors hover:border-gold/60 hover:text-burgundy"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  {t('addressEdit')}
                </button>
                {!address.is_default ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => makeDefault(address)}
                    className="rounded-[var(--radius-pill)] border border-rule px-3 py-1.5 text-caption font-semibold text-ink transition-colors hover:border-gold/60 hover:text-burgundy"
                  >
                    {t('addressMakeDefault')}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => remove(address)}
                  className="ms-auto inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-caption text-muted transition-colors hover:text-burgundy"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6" />
                  </svg>
                  {t('addressDelete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing === null ? (
        <button
          type="button"
          onClick={() => {
            setEditing('new');
            setForm({ ...EMPTY, isDefault: addresses.length === 0 });
            setError(false);
          }}
          className="btn btn-solid inline-flex items-center gap-2"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {t('addressAdd')}
        </button>
      ) : (
        <form
          onSubmit={submit}
          noValidate
          className="space-y-4 rounded-[var(--radius-lg)] border border-rule bg-cream p-5 shadow-[var(--shadow-soft)] sm:p-6"
        >
          <h2 className="font-serif text-h3 text-ink">
            {editing === 'new' ? t('addressAdd') : t('addressEdit')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              id="ab-label"
              label={t('addressLabelField')}
              input={
                <input id="ab-label" type="text" value={form.label} placeholder={t('addressLabelPlaceholder')} onChange={(e) => set('label', e.target.value)} className={inputCls} />
              }
            />
            <FieldRow
              id="ab-recipient"
              label={t('recipientName')}
              input={
                <input id="ab-recipient" type="text" required autoComplete="name" value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} className={inputCls} />
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow
              id="ab-phone"
              label={t('recipientPhone')}
              input={
                <input id="ab-phone" type="tel" dir="ltr" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputCls} />
              }
            />
            <FieldRow
              id="ab-city"
              label={t('city')}
              input={
                <AddressAutocomplete id="ab-city" required autoComplete="address-level2" value={form.city} onChange={(next) => set('city', next)} fetcher={searchCities} className={inputCls} />
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
            <FieldRow
              id="ab-street"
              label={t('street')}
              input={
                <AddressAutocomplete id="ab-street" required autoComplete="address-line1" value={form.street} onChange={(next) => set('street', next)} fetcher={(q) => searchStreets(form.city, q)} className={inputCls} />
              }
            />
            <FieldRow
              id="ab-house"
              label={t('houseNumber')}
              input={
                <input id="ab-house" type="text" inputMode="numeric" required value={form.houseNumber} onChange={(e) => set('houseNumber', e.target.value)} className={inputCls} />
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <FieldRow id="ab-entrance" label={t('entrance')} input={<input id="ab-entrance" type="text" value={form.entrance} onChange={(e) => set('entrance', e.target.value)} className={inputCls} />} />
            <FieldRow id="ab-floor" label={t('floor')} input={<input id="ab-floor" type="text" inputMode="numeric" value={form.floor} onChange={(e) => set('floor', e.target.value)} className={inputCls} />} />
            <FieldRow id="ab-apartment" label={t('apartment')} input={<input id="ab-apartment" type="text" inputMode="numeric" value={form.apartment} onChange={(e) => set('apartment', e.target.value)} className={inputCls} />} />
            <FieldRow id="ab-zip" label={t('zip')} input={<input id="ab-zip" type="text" dir="ltr" inputMode="numeric" autoComplete="postal-code" value={form.zip} onChange={(e) => set('zip', e.target.value)} className={inputCls} />} />
          </div>
          <label className="flex items-center gap-2 text-small text-ink">
            <input
              type="checkbox"
              checked={form.isDefault}
              onChange={(e) => set('isDefault', e.target.checked)}
              className="accent-[var(--color-burgundy)]"
            />
            {t('addressSetDefault')}
          </label>
          {error ? (
            <p role="alert" className="text-small text-burgundy">
              {t('addressSaveError')}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="btn btn-solid">
              {t('addressSave')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setError(false);
              }}
              className="btn btn-quiet"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
