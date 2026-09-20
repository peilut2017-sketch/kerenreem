'use client';

import { useActionState, useEffect, useId, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { submitContact, type ContactFormState } from '@/app/(public)/[locale]/contact/actions';
import { restoreFormValues } from '@/lib/restore-form';
import { localized } from '@/lib/localized';
import { ContactAttachmentsField } from './ContactAttachmentsField';
import { Captcha } from './Captcha';
import type { ContactField, ContactTopic } from '@/lib/supabase/types';

const INITIAL: ContactFormState = { status: 'idle' };

/**
 * טופס יצירת קשר.
 *
 * נגישות: לכל שדה <label> קשור, שגיאות מקושרות ב-aria-describedby ומסומנות
 * ב-aria-invalid, וההודעה המסכמת מוכרזת ב-role="status". זו הדרישה המהותית
 * של תקן 5568 — סרגל הנגישות אינו מכסה עליה.
 *
 * topics/fields מגיעים מהעמוד (Server Component) ומנוהלים בניהול —
 * בורר תחום הפנייה ושדות מותאמים מוצגים רק כשיש לפחות רשומה מפורסמת
 * אחת מכל סוג, כדי שאתר טרי בלי הגדרה לא יציג בורר או שאלה ריקים.
 */
export function ContactForm({
  topics = [],
  fields = [],
}: {
  topics?: ContactTopic[];
  fields?: ContactField[];
}) {
  const t = useTranslations('contact');
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const submitted = useRef<FormData | null>(null);

  // React מאפס את הטופס אחרי הפעולה; בלי השחזור הזה שגיאה בשדה אחד מוחקת
  // הודעה שלמה שהמבקר כתב.
  const [state, action, pending] = useActionState(
    async (previous: ContactFormState, formData: FormData) => {
      submitted.current = formData;
      return submitContact(previous, formData);
    },
    INITIAL,
  );
  const id = useId();

  useEffect(() => {
    if (state.status !== 'error' || !formRef.current || !submitted.current) return;
    restoreFormValues(formRef.current, submitted.current);
  }, [state]);

  // מיקוד אחרי שליחה: בכשל — לשדה הראשון עם שגיאה (אחרת קורא מסך נשאר על
  // כפתור השליחה ולא שומע מה נכשל); בהצלחה — להודעת האישור, כי הטופס
  // כולו (והכפתור הממוקד) הוחלף בה והמיקוד היה נופל ל-body.
  useEffect(() => {
    if (state.status === 'error') {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    } else if (state.status === 'success') {
      successRef.current?.focus();
    }
  }, [state]);

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
      <p ref={successRef} tabIndex={-1} role="status" className="border-s-2 border-burgundy bg-cream-2 px-5 py-4 text-ink outline-none">
        {t('success')}
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
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

        {topics.length > 0 ? (
          <div>
            <label htmlFor={`${id}-topic_id`} className="field-label">
              {t('topicLabel')}
            </label>
            <select {...field('topic_id')}>
              <option value="">{t('topicEmpty')}</option>
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {localized(topic, 'name', locale)}
                </option>
              ))}
            </select>
            {errorFor('topic_id')}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor={`${id}-message`} className="field-label">
          {t('message')} <span aria-hidden="true">*</span>
        </label>
        <textarea rows={7} required {...field('message')} />
        {errorFor('message')}
      </div>

      {fields.map((customField) => (
        <CustomFieldInput key={customField.id} field={customField} locale={locale} fieldProps={field} errorFor={errorFor} idPrefix={id} />
      ))}

      <ContactAttachmentsField name="attachments" />

      <div>
        <label htmlFor={`${id}-consent`} className="flex items-start gap-3 text-small text-ink-soft on-dark:text-cream-2">
          <input
            type="checkbox"
            id={`${id}-consent`}
            name="consent"
            required
            aria-invalid={state.fieldErrors?.consent ? true : undefined}
            aria-describedby={state.fieldErrors?.consent ? `${id}-consent-error` : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
          />
          <span>
            {t('consentPrefix')} <Link href="/terms" className="link">{t('termsLinkLabel')}</Link>{' '}
            {t('consentSuffix')}
          </span>
        </label>
        {errorFor('consent')}
      </div>

      <Captcha resetSignal={state} />

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

type FieldProps = (name: string) => {
  id: string;
  name: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
  className: string;
};

/**
 * שדה מותאם אישית (ניהול → פניות מהאתר → שדות מותאמים), מוצג לפי סוגו.
 * name הוא custom_{id} — כך ש-submitContact יודע להבחין בין תשובות
 * לשדות המותאמים לבין השדות הקבועים בלי להתנגש בשם.
 */
function CustomFieldInput({
  field: customField,
  locale,
  fieldProps,
  errorFor,
  idPrefix,
}: {
  field: ContactField;
  locale: string;
  fieldProps: FieldProps;
  errorFor: (name: string) => React.ReactNode;
  idPrefix: string;
}) {
  const name = `custom_${customField.id}`;
  const label = localized(customField, 'label', locale);
  const inputId = `${idPrefix}-${name}`;
  const requiredMark = customField.is_required ? <span aria-hidden="true">*</span> : null;

  if (customField.field_type === 'checkbox') {
    return (
      <div>
        <label htmlFor={inputId} className="flex items-start gap-3 text-small text-ink-soft on-dark:text-cream-2">
          <input
            type="checkbox"
            id={inputId}
            name={name}
            required={customField.is_required}
            aria-invalid={fieldProps(name)['aria-invalid']}
            aria-describedby={fieldProps(name)['aria-describedby']}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
          />
          <span>
            {label} {requiredMark}
          </span>
        </label>
        {errorFor(name)}
      </div>
    );
  }

  if (customField.field_type === 'textarea') {
    return (
      <div>
        <label htmlFor={inputId} className="field-label">
          {label} {requiredMark}
        </label>
        <textarea rows={4} required={customField.is_required} {...fieldProps(name)} />
        {errorFor(name)}
      </div>
    );
  }

  if (customField.field_type === 'select') {
    const options = localized(customField, 'options', locale)
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean);

    return (
      <div>
        <label htmlFor={inputId} className="field-label">
          {label} {requiredMark}
        </label>
        <select required={customField.is_required} {...fieldProps(name)}>
          <option value="">—</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {errorFor(name)}
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="field-label">
        {label} {requiredMark}
      </label>
      <input type="text" required={customField.is_required} {...fieldProps(name)} />
      {errorFor(name)}
    </div>
  );
}
