'use client';

import { useId, useState, useTransition, type ReactNode } from 'react';
import { toggleEntityField } from '@/lib/admin/actions';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { Spinner } from './SubmitButton';

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
  /** 'auto' — הדפדפן קובע כיוון לפי התו הראשון שהוקלד; לשדות שיכולים לקבל גם עברית וגם לטינית (כמו slug). */
  dir?: 'rtl' | 'ltr' | 'auto';
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

/**
 * [1.10] טוגל־סליידר — לא עוד תיבת סימון מרובעת. שלושה מצבי שימוש:
 *
 * 1. entityKey+id מסופקים (רשומה קיימת מתוך ENTITIES): הלחיצה שומרת מיד
 *    דרך toggleEntityField, בלי לחכות לכפתור "שמירה" של שאר הטופס — עדכון
 *    אופטימי עם חזרה אחורה במקרה כשל. השדה *לא* משתתף בשליחת ה-form
 *    (בלי name), כי הוא כבר נשמר בפני עצמו.
 * 2. onToggle מסופק (טפסים ייעודיים מחוץ ל-ENTITIES, כמו הגדרות חנות):
 *    אותה התנהגות אוטומטית, אבל דרך פעולת שמירה מותאמת שהקורא מספק.
 * 3. בלעדיהם (רשומה חדשה שטרם נשמרה): מתנהג כמו תיבת סימון רגילה בתוך
 *    טופס — defaultChecked לא מבוקר, ומשתתף בשליחה הכוללת (name).
 */
export function ToggleField({
  name,
  label,
  hint,
  defaultChecked,
  disabled,
  entityKey,
  id: recordId,
  onToggle,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** ישות ומזהה רשומה קיימת — כשמסופקים שניהם, השינוי נשמר מיד (ראו תיעוד למעלה). */
  entityKey?: string;
  id?: string | null;
  /** פעולת שמירה מותאמת — חלופה ל-entityKey+id לטפסים מחוץ ל-ENTITIES. */
  onToggle?: (next: boolean) => Promise<{ ok: boolean; error?: string }>;
}) {
  const id = useId();
  const autoSave = Boolean(onToggle) || Boolean(entityKey && recordId);
  const [checked, setChecked] = useState(defaultChecked ?? false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(next: boolean) {
    if (!autoSave) return;
    const previous = checked;
    setChecked(next);
    setError(null);
    startTransition(async () => {
      const result = onToggle
        ? await onToggle(next)
        : await toggleEntityField(entityKey!, recordId!, name, next);
      if (!result.ok) {
        setChecked(previous);
        setError(result.error ?? 'השמירה נכשלה');
      }
    });
  }

  const isDisabled = disabled || (autoSave && pending);

  return (
    <div>
      <label
        htmlFor={id}
        className={`flex items-center justify-between gap-3 rounded-[var(--admin-radius-btn)] border border-transparent px-1 py-1.5 text-small text-ink-soft transition-colors ${
          isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-cream-2'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {label}
          {autoSave && pending ? <Spinner className="h-3 w-3 shrink-0 text-muted" /> : null}
        </span>
        <span
          aria-hidden="true"
          className={`relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors ${
            (autoSave ? checked : defaultChecked) ? 'bg-[var(--admin-accent)]' : 'bg-[var(--admin-border)]'
          }`}
        >
          {/* מיקום פיזי (right), לא לוגי: הניהול תמיד dir="rtl" קבוע, אז
              "כבוי" תמיד מימין ו"מופעל" תמיד משמאל — בדיוק "סליידר מימין
              לשמאל" כמקובל היום. */}
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[right] duration-200 ${
              (autoSave ? checked : defaultChecked) ? 'right-[1.375rem]' : 'right-0.5'
            }`}
          />
        </span>
        <input
          id={id}
          name={autoSave ? undefined : name}
          type="checkbox"
          role="switch"
          {...(autoSave
            ? { checked, onChange: (event: React.ChangeEvent<HTMLInputElement>) => handleChange(event.target.checked) }
            : { defaultChecked })}
          disabled={isDisabled}
          aria-checked={autoSave ? checked : undefined}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          className="sr-only"
        />
      </label>
      {error ? (
        <span role="alert" className="admin-field-hint ms-1 block text-[var(--admin-danger)]">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="admin-field-hint ms-1">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/**
 * קיבוץ שדות תחת כותרת — כרטיס עצמאי (לא מקטע שטוח בתוך רשימה ארוכה).
 * [1.28] כל FieldSet הוא עכשיו admin-card משלו: משטח מוגבה, פינות
 * עגולות, צל — לא רק קו הפרדה עליון בין מקטעים באותה רשימה רציפה.
 */
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
    <fieldset className="admin-card block p-5 sm:p-6">
      <legend className="-mt-1 flex items-center gap-2.5 pe-3 text-small font-bold text-ink">
        {icon ? (
          <span className="admin-icon-chip h-8 w-8">
            <AdminIcon name={icon} className="h-4 w-4" />
          </span>
        ) : null}
        {legend}
      </legend>
      {description ? <p className="mb-5 mt-2 text-caption text-muted">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </fieldset>
  );
}
