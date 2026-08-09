'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { BlockShell } from './BlockShell';
import type { ActionResult } from '@/lib/commerce/checkout-actions';

/**
 * בלוק 1 — זיהוי (פרק 7.1): טלפון תחילה, שם, מייל חובה עם ההסבר.
 * המשך כאורח הוא ברירת המחדל; אין שום מסך הרשמה בנתיב התשלום.
 */

export interface ContactValues {
  phone: string;
  name: string;
  email: string;
}

export function ContactBlock({
  open,
  done,
  initial,
  supportPhone,
  onOpen,
  onSubmit,
}: {
  open: boolean;
  done: boolean;
  initial: ContactValues;
  supportPhone: string | null;
  onOpen: () => void;
  onSubmit: (values: ContactValues) => Promise<ActionResult>;
}) {
  const t = useTranslations('store');
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError(false);
    try {
      const result = await onSubmit(values);
      setErrors(
        result.fieldErrors
          ? Object.fromEntries(
              Object.entries(result.fieldErrors).map(([key, kind]) => [
                key,
                kind === 'invalid'
                  ? key === 'phone'
                    ? t('errPhone')
                    : t('errEmail')
                  : t('errRequired'),
              ]),
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

  return (
    <BlockShell
      index={1}
      title={t('contactTitle')}
      open={open}
      done={done}
      onOpen={onOpen}
      summary={done ? `${initial.name || values.name} · ${values.phone || initial.phone}` : undefined}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="checkout-phone"
          label={t('phone')}
          error={errors.phone}
          input={
            <input
              id="checkout-phone"
              type="tel"
              inputMode="tel"
              dir="ltr"
              autoComplete="tel"
              required
              value={values.phone}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              aria-invalid={errors.phone ? true : undefined}
              aria-describedby={errors.phone ? 'checkout-phone-error' : undefined}
              className="w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          }
        />
        <Field
          id="checkout-name"
          label={t('fullName')}
          error={errors.name}
          input={
            <input
              id="checkout-name"
              type="text"
              autoComplete="name"
              required
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'checkout-name-error' : undefined}
              className="w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          }
        />
        <Field
          id="checkout-email"
          label={t('email')}
          hint={t('emailHint')}
          error={errors.email}
          input={
            <input
              id="checkout-email"
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="email"
              required
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'checkout-email-error' : 'checkout-email-hint'}
              className="w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          }
        />

        {supportPhone ? (
          <p className="text-caption text-muted">{t('noEmailLine', { phone: supportPhone })}</p>
        ) : null}

        {formError ? (
          <p role="alert" className="text-caption text-burgundy">
            {t('errServer')}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn btn-solid">
          {t('continueButton')}
        </button>
      </form>
    </BlockShell>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  input,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-small font-semibold text-ink">
        {label}
      </label>
      {input}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-caption text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-caption text-burgundy">
          {error}
        </p>
      ) : null}
    </div>
  );
}
