'use client';

import { useId, type ReactNode } from 'react';

/**
 * שדות הטופס של ממשק הניהול.
 *
 * כל שדה מקבל <label> קשור ב-htmlFor, שגיאות מקושרות ב-aria-describedby,
 * ומצב שגיאה ב-aria-invalid. אותם כללי נגישות שחלים על האתר הציבורי חלים
 * גם כאן — הצוות עשוי לכלול משתמשי מקלדת או קורא מסך.
 */

interface BaseProps {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

function Wrapper({
  id,
  label,
  hint,
  error,
  required,
  children,
}: BaseProps & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({
  defaultValue,
  type = 'text',
  dir,
  placeholder,
  ...props
}: BaseProps & {
  defaultValue?: string | number | null;
  type?: 'text' | 'number' | 'url' | 'date' | 'email';
  dir?: 'rtl' | 'ltr';
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Wrapper id={id} {...props}>
      <input
        id={id}
        name={props.name}
        type={type}
        dir={dir}
        placeholder={placeholder}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.hint, props.error)}
        className="field-input"
      />
    </Wrapper>
  );
}

export function TextAreaField({
  defaultValue,
  rows = 4,
  ...props
}: BaseProps & { defaultValue?: string | null; rows?: number }) {
  const id = useId();
  return (
    <Wrapper id={id} {...props}>
      <textarea
        id={id}
        name={props.name}
        rows={rows}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.hint, props.error)}
        className="field-input"
      />
    </Wrapper>
  );
}

export function SelectField({
  defaultValue,
  value,
  onChange,
  options,
  emptyLabel,
  ...props
}: BaseProps & {
  defaultValue?: string | null;
  /** מצב מבוקר, לצד onChange. בלעדיו השדה אינו מבוקר וניזון מ-defaultValue. */
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
}) {
  const id = useId();
  const controlled = value !== undefined;
  const current = (controlled ? value : defaultValue) ?? '';

  // ערך קיים במסד שאינו מופיע ברשימת האפשרויות — למשל שיוך לרשומה שנמחקה
  // בלי שהעמודה עצמה התאפסה. בלי אפשרות מפורשת עבורו, הדפדפן "בוחר" בשקט
  // את האפשרות הראשונה ברשימה, וזה מוצג כאילו הוא הערך השמור בפועל: שם
  // מחבר או קטגוריה אחרים לגמרי, בלי שום סימן שמשהו השתבש.
  const isStale = current !== '' && !options.some((option) => option.value === current);

  return (
    <Wrapper id={id} {...props}>
      <select
        id={id}
        name={props.name}
        {...(controlled ? { value: current, onChange } : { defaultValue: current })}
        required={props.required}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.hint, props.error)}
        className="field-input"
      >
        {emptyLabel ? <option value="">{emptyLabel}</option> : null}
        {isStale ? <option value={current}>⚠ ערך לא מוכר ({current})</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-3 text-small text-ink-soft">
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <span id={`${id}-hint`} className="field-hint ms-7">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** קיבוץ שדות תחת כותרת — מחליף כרטיסים נפרדים בטופס ארוך. */
export function FieldSet({
  legend,
  description,
  children,
}: {
  legend: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-rule pt-6">
      <legend className="eyebrow pe-3">{legend}</legend>
      {description ? <p className="mb-5 mt-1 text-caption text-muted">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}
