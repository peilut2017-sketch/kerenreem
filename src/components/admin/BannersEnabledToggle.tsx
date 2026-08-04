'use client';

import { useState, useTransition } from 'react';
import { saveBannersEnabled } from '@/lib/admin/settings-actions';

/**
 * כיבוי/הפעלה מלאה של קרוסלת הבאנרים בעמוד הבית — נפרד ממצב הפרסום של
 * כל באנר בודד (ראו saveBannersEnabled). מתג מיידי כמו MessageToggle,
 * לא חלק מטופס: זהו דגל בודד בלי שדות נלווים.
 */
export function BannersEnabledToggle({ enabled }: { enabled: boolean }) {
  const [current, setCurrent] = useState(enabled);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="admin-card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div>
        <p className="font-semibold text-ink">תצוגת קרוסלת הבאנרים</p>
        <p className="mt-0.5 text-caption text-muted">
          כיבוי מסתיר את הקרוסלה מעמוד הבית לגמרי, גם אם יש באנרים מפורסמים. העמוד נופל אז לגיבוי הרגיל
          (קרוסלה מתוכן שפורסם, או כותרת פתיחה).
        </p>
        {error ? (
          <p role="alert" className="mt-1 text-caption text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        disabled={pending}
        aria-pressed={current}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const next = !current;
            const result = await saveBannersEnabled(next);
            if (result?.error) {
              setError(result.error);
              return;
            }
            setCurrent(next);
          })
        }
        className={`admin-badge admin-badge-button shrink-0 ${current ? 'admin-badge-success' : 'admin-badge-warning'}`}
      >
        <span className="admin-badge-dot" aria-hidden="true" />
        {current ? 'מוצגת' : 'כבויה'}
      </button>
    </div>
  );
}
