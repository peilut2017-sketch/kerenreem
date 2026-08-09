'use client';

import { useId, type ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';

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
      <label htmlFor={id} className="admin-field-label">
        {label}
        {required ? (
          <span aria-hidden="true" className="ms-0.5 text-[var(--admin-danger)]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <span id={`${id}-hint`} className="admin-field-hint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="admin-field-error">
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
  icon,
  min,
  max,
  step,
  ...props
}: BaseProps & {
  defaultValue?: string | number | null;
  type?: 'text' | 'number' | 'url' | 'date' | 'email';
  dir?: 'rtl' | 'ltr';
  placeholder?: string;
  /** אייקון מוביל ברשות — לשדות שבהם הוא מוסיף זיהוי מהיר (חיפוש, קישור, תאריך) */
  icon?: AdminIconName;
  /** גבולות לשדות מספריים — מחיר ומלאי אינם שליליים, מלאי הוא שלם */
  min?: number;
  max?: number;
  step?: number | 'any';
}) {
  const id = useId();
  return (
    <Wrapper id={id} {...props}>
      <div className="relative">
        {icon ? (
          <AdminIcon
            name={icon}
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
          />
        ) : null}
        <input
          id={id}
          name={props.name}
          type={type}
          dir={dir}
          placeholder={placeholder}
          required={props.required}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue ?? ''}
          aria-invalid={props.error ? true : undefined}
          aria-describedby={describedBy(id, props.hint, props.error)}
          className={`admin-field-input ${icon ? 'ps-9' : ''}`}
        />
      </div>
    </Wrapper>
  );
}

export function TextAreaField({
  defaultValue,
  rows = 4,
  dir,
  ...props
}: BaseProps & { defaultValue?: string | null; rows?: number; dir?: 'rtl' | 'ltr' }) {
  const id = useId();
  return (
    <Wrapper id={id} {...props}>
      <textarea
        id={id}
        name={props.name}
        rows={rows}
        dir={dir}
        required={props.required}
        defaultValue={defaultValue ?? ''}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={describedBy(id, props.hint, props.error)}
        className="admin-field-input"
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
        className="admin-field-input"
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
  disabled,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex items-start gap-3 rounded-[var(--admin-radius-btn)] border border-transparent px-1 py-1 text-small text-ink-soft transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-cream-2'
        }`}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          defaultChecked={defaultChecked}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--admin-accent)]"
        />
        <span>{label}</span>
      </label>
      {hint ? (
        <span id={`${id}-hint`} className="admin-field-hint ms-8">
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
  icon,
  children,
}: {
  legend: string;
  description?: string;
  /** אייקון מוביל ברשות ליד הכותרת — למקטעים מרכזיים בטופס הספר */
  icon?: AdminIconName;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-t border-rule pt-6 first:border-t-0 first:pt-0">
      <legend className="flex items-center gap-2 pe-3 text-small font-bold text-ink">
        {icon ? (
          <span className="admin-icon-chip h-7 w-7">
            <AdminIcon name={icon} className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {legend}
      </legend>
      {description ? <p className="mb-5 mt-2 text-caption text-muted">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}
