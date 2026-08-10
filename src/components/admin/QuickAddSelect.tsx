'use client';

import { useId, useState, useTransition } from 'react';
import { Drawer } from '../Drawer';
import { SelectField } from './Fields';

interface Option {
  value: string;
  label: string;
}

/**
 * בחירה עם יצירה תוך כדי מילוי הטופס — למחבר ולקטגוריה בטופס הספר.
 *
 * בלי זה, הוספת ספר למחבר או לקטגוריה שעוד לא קיימים דורשת לעזוב את
 * הטופס, ליצור אותם במסך נפרד ולחזור למלא הכול מחדש. השדה כאן מבוקר
 * (value/onChange) ולא מסתמך על defaultValue, כי הפריט החדש צריך
 * להיבחר מיד אחרי היצירה בלי לגעת בשאר הטופס.
 */
export function QuickAddSelect({
  name,
  label,
  hint,
  emptyLabel,
  options,
  defaultValue,
  addLabel,
  fieldLabel,
  onCreate,
  onChange,
}: {
  name: string;
  label: string;
  hint?: string;
  emptyLabel: string;
  options: Option[];
  defaultValue?: string | null;
  /** תווית כפתור הפתיחה, למשל "+ מחבר חדש" */
  addLabel: string;
  /** תווית שדה השם במגירה, למשל "שם המחבר" */
  fieldLabel: string;
  onCreate: (name: string) => Promise<Option | null>;
  /** נקרא בכל שינוי בחירה (כולל יצירה מהירה) — לרכיב הורה שצריך לדעת מה נבחר עכשיו, למשל SeriesOrderList */
  onChange?: (value: string) => void;
}) {
  const [extra, setExtra] = useState<Option[]>([]);
  const [selected, setSelectedState] = useState(defaultValue ?? '');
  const setSelected = (value: string) => {
    setSelectedState(value);
    onChange?.(value);
  };
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const inputId = useId();

  function submit() {
    const trimmed = draft.trim();
    if (!trimmed) return;

    startTransition(async () => {
      setError(null);
      const created = await onCreate(trimmed);
      if (!created) {
        setError('היצירה נכשלה. ייתכן שכבר קיים פריט בשם זה.');
        return;
      }
      setExtra((current) => [...current, created]);
      setSelected(created.value);
      setDraft('');
      setOpen(false);
    });
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <SelectField
            name={name}
            label={label}
            hint={hint}
            emptyLabel={emptyLabel}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            options={[...options, ...extra]}
          />
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn btn-quiet mb-0.5 whitespace-nowrap"
        >
          {addLabel}
        </button>
      </div>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        title={addLabel}
        widthClassName="max-w-sm"
        footer={
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={submit}
            className="btn btn-solid flex-1"
          >
            {pending ? 'שומר…' : 'יצירה ובחירה'}
          </button>
        }
      >
        <label htmlFor={inputId} className="field-label">
          {fieldLabel}
        </label>
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          className="field-input"
        />
        {error ? (
          <p role="alert" className="field-error mt-2">
            {error}
          </p>
        ) : null}
      </Drawer>
    </div>
  );
}
