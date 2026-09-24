'use client';

import { useState, useTransition } from 'react';
import { saveInquiryInboxes } from '@/lib/admin/email-actions';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

/**
 * ‏[1.41] כתובות היעד לפניות מהאתר.
 *
 * שתי כתובות ולא אחת, כי שני סוגי הפניות אינם מגיעים לאותו אדם: פנייה
 * כללית היא לרוב שאלה מנהלית, ופנייה על ספר היא שאלה תוכנית או הערת
 * הגהה. עד כה שתיהן נחתו באותה תיבה, והיעד נקבע במשתנה סביבה — כלומר
 * שינוי שלו דרש פריסה מחדש.
 *
 * שדה ריק אינו שגיאה: הוא אומר "בלי כתובת ייעודית", והפנייה נופלת
 * חזרה לתיבה הכללית. לכן גם אין כאן כפתור "מחיקה" — ריקון השדה הוא
 * המחיקה, וזה מה שכתוב מתחתיו.
 */
export function InquiryInboxForm({
  initial,
  fallback,
}: {
  initial: { general: string; book: string };
  /** התיבה שאליה נופלים כשאין כתובת ייעודית — מוצגת כדי שלא ינחשו. */
  fallback: string | null;
}) {
  const [values, setValues] = useState(initial);
  const [saving, startSave] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const dirty = values.general !== initial.general || values.book !== initial.book;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSave(async () => {
      setResult(null);
      const response = await saveInquiryInboxes(values);
      setResult(
        response.ok
          ? { ok: true, message: 'הכתובות נשמרו.' }
          : { ok: false, message: response.error ?? 'השמירה נכשלה' },
      );
    });
  }

  return (
    <form onSubmit={submit} className="admin-card mb-6 p-4">
      <h2 className="font-serif text-h3 text-ink">לאן מגיעות פניות מהאתר</h2>
      <p className="mt-1 text-small text-ink-soft">
        אפשר לכוון כל סוג פנייה לכתובת אחרת. שדה ריק — הפנייה תגיע לתיבה הכללית
        {fallback ? ` (${fallback})` : ''}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="פנייה כללית"
          hint="טופס יצירת הקשר"
          value={values.general}
          onChange={(general) => setValues((current) => ({ ...current, general }))}
        />
        <Field
          label="פנייה על ספר"
          hint="הערות והארות מעמוד הספר"
          value={values.book}
          onChange={(book) => setValues((current) => ({ ...current, book }))}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
        <button type="submit" disabled={saving || !dirty} className="admin-btn admin-btn-solid">
          {saving ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
          שמירה
        </button>
        {result ? (
          <p
            role="status"
            className={`text-small ${result.ok ? 'text-[var(--admin-success)]' : 'text-[var(--admin-danger)]'}`}
          >
            {result.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="admin-field-label">{label}</span>
      <input
        type="email"
        dir="ltr"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="name@kerenreem.org"
        className="admin-field-input mt-1 w-full text-start"
      />
      <span className="admin-field-hint">{hint}</span>
    </label>
  );
}
