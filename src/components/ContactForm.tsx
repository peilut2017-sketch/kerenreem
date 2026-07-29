'use client';

import { useActionState, useId } from 'react';
import { useTranslations } from 'next-intl';
import { submitContact, type ContactFormState } from '@/app/(public)/[locale]/contact/actions';

const INITIAL: ContactFormState = { status: 'idle' };

/**
 * טופס יצירת קשר.
 *
 * נגישות: לכל שדה <label> קשור, שגיאות מקושרות ב-aria-describedby ומסומנות
 * ב-aria-invalid, וההודעה המסכמת מוכרזת ב-role="status". זו הדרישה המהותית
 * של תקן 5568 — סרגל הנגישות אינו מכסה עליה.
 */
export function ContactForm() {
  const t = useTranslations('contact');
  const [state, action, pending] = useActionState(submitContact, INITIAL);
  const id = useId();

  const field = (name: string) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': state.fieldErrors?.[name] ? (true as const) : undefined,
    'aria-describedby': state.fieldErrors?.[name] ? `${id}-${name}-error` : undefined,
    className: 'field-input',
  });

  const errorFor = (name: string) =>
    state.fieldErrors?.[name] ? (
      <span id={`${id}-${name}-error`} className="field-error">
        {state.fieldErrors[name]}
      </span>
    ) : null;

  if (state.status === 'success') {
    return (
      <p role="status" className="border-s-2 border-burgundy bg-paper-2 px-5 py-4 text-ink">
        {t('success')}
      </p>
    );
  }

  return (
    <form action={action} noValidate className="space-y-5">
      {/* מלכודת בוטים — מוסתרת מהעין וגם מקוראי מסך.
          sr-only ולא מיקום שלילי: הזזה אל מחוץ למסך מרחיבה את שטח הגלילה
          במסמך RTL ויוצרת גלילה אופקית בכל העמוד. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="field-label">
            {t('name')} <span aria-hidden="true">*</span>
          </label>
          <input type="text" autoComplete="name" required {...field('name')} />
          {errorFor('name')}
        </div>

        <div>
          <label htmlFor={`${id}-email`} className="field-label">
            {t('email')} <span aria-hidden="true">*</span>
          </label>
          <input type="email" autoComplete="email" required dir="ltr" {...field('email')} />
          {errorFor('email')}
        </div>

        <div>
          <label htmlFor={`${id}-phone`} className="field-label">
            {t('phone')}
          </label>
          <input type="tel" autoComplete="tel" dir="ltr" {...field('phone')} />
          {errorFor('phone')}
        </div>

        <div>
          <label htmlFor={`${id}-subject`} className="field-label">
            {t('subject')}
          </label>
          <input type="text" {...field('subject')} />
          {errorFor('subject')}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-message`} className="field-label">
          {t('message')} <span aria-hidden="true">*</span>
        </label>
        <textarea rows={7} required {...field('message')} />
        {errorFor('message')}
      </div>

      <div>
        <label htmlFor={`${id}-consent`} className="flex items-start gap-3 text-small text-ink-soft">
          <input
            type="checkbox"
            id={`${id}-consent`}
            name="consent"
            required
            aria-invalid={state.fieldErrors?.consent ? true : undefined}
            aria-describedby={state.fieldErrors?.consent ? `${id}-consent-error` : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
          />
          <span>{t('consent')}</span>
        </label>
        {errorFor('consent')}
      </div>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="field-error">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-solid">
        {pending ? t('sending') : t('send')}
      </button>
    </form>
  );
}
