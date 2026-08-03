'use client';

import { useState, useTransition } from 'react';
import { deleteEntity } from '@/lib/admin/actions';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

/**
 * מחיקה בשני שלבים. אין חלון confirm של הדפדפן — הוא אינו נגיש לקורא מסך
 * ולא ניתן לעיצוב. במקומו האישור מופיע בתוך הדף עצמו.
 */
export function DeleteButton({ entity, id }: { entity: string; id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="admin-btn admin-btn-danger">
        <AdminIcon name="trash" className="h-4 w-4" />
        מחיקה
      </button>
    );
  }

  return (
    <span className="flex flex-col items-start gap-2 text-small">
      <span className="flex flex-wrap items-center gap-2">
        <span role="alert" className="font-semibold text-[var(--admin-danger)]">
          למחוק לצמיתות?
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              // כשל מחיקה היה חוזר כ-void ונרשם ליומן בלבד: המשתמש לחץ
              // "כן, למחוק", שום דבר לא קרה, ולא היה שום הסבר.
              const result = await deleteEntity(entity, id);
              if (result?.error) {
                setError(result.error);
                setConfirming(false);
              }
            })
          }
          className="admin-btn admin-btn-danger"
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
          {pending ? 'מוחק…' : 'כן, למחוק'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="admin-btn admin-btn-ghost">
          <AdminIcon name="x" className="h-4 w-4" />
          ביטול
        </button>
      </span>
      {error ? (
        <span role="alert" className="text-caption text-[var(--admin-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
