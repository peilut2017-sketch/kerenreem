'use client';

import { useId, useState } from 'react';

/**
 * רשימת שדות טקסט חוזרים, כולם באותו name — למשל ציטוטים. FormData.getAll
 * אוסף את כולם בשמירה (ראו coerce('text[]') ב-actions.ts), בדיוק כמו
 * צ'ק־בוקסים של שפה. שורה ריקה נזרקת בשמירה ולא צריך למנוע אותה כאן.
 */
let nextRowId = 0;
/** מזהה יציב לכל שורה, לא אינדקס — ראו ההערה ליד ה-key למטה. */
function makeRow(value: string) {
  nextRowId += 1;
  return { key: nextRowId, value };
}

export function RepeatableTextField({
  name,
  label,
  hint,
  defaultValues,
  placeholder,
  multiline = false,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultValues: string[];
  placeholder?: string;
  multiline?: boolean;
}) {
  const [rows, setRows] = useState(() =>
    (defaultValues.length > 0 ? defaultValues : ['']).map(makeRow),
  );
  const id = useId();
  const Field = multiline ? 'textarea' : 'input';

  return (
    <div>
      <span className="field-label">{label}</span>
      <div className="mt-1 space-y-2">
        {rows.map((row, index) => (
          // key הוא מזהה יציב ולא אינדקס: השדות אינם מבוקרים
          // (defaultValue), והסרת שורה אמצעית עם key={index} הייתה
          // משאירה בטעות את הערך הישן בשדה שקיבל את האינדקס הפנוי,
          // כי defaultValue מתעלם מעדכונים אחרי העיגון הראשוני.
          <div key={row.key} className="flex items-start gap-2">
            <Field
              name={name}
              defaultValue={row.value}
              placeholder={placeholder}
              rows={multiline ? 3 : undefined}
              aria-label={`${label} ${index + 1}`}
              className="field-input flex-1"
            />
            <button
              type="button"
              onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
              aria-label={`הסרת ${label} ${index + 1}`}
              className="mt-2 shrink-0 text-caption text-muted transition-colors hover:text-burgundy"
            >
              הסרה
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setRows((current) => [...current, makeRow('')])}
        className="mt-2 text-caption text-burgundy underline underline-offset-4"
      >
        + הוספת שורה
      </button>
      {hint ? (
        <span id={`${id}-hint`} className="field-hint block">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
