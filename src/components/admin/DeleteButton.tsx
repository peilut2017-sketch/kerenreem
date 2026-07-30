'use client';

import { useState, useTransition } from 'react';
import { deleteEntity } from '@/lib/admin/actions';
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
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-small text-burgundy underline underline-offset-4"
      >
        מחיקה
      </button>
    );
  }

  return (
    <span className="flex flex-col items-start gap-1 text-small">
      <span className="flex items-center gap-3">
        <span role="alert">למחוק לצמיתות?</span>
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
          className="inline-flex items-center gap-1.5 font-semibold text-burgundy underline underline-offset-4"
        >
          {pending ? <Spinner className="h-3 w-3" /> : null}
          {pending ? 'מוחק…' : 'כן, למחוק'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-muted underline underline-offset-4"
        >
          ביטול
        </button>
      </span>
      {error ? (
        <span role="alert" className="text-caption text-burgundy">
          {error}
        </span>
      ) : null}
    </span>
  );
}
