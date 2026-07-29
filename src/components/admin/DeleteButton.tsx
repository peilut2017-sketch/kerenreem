'use client';

import { useState, useTransition } from 'react';
import { deleteEntity } from '@/lib/admin/actions';

/**
 * מחיקה בשני שלבים. אין חלון confirm של הדפדפן — הוא אינו נגיש לקורא מסך
 * ולא ניתן לעיצוב. במקומו האישור מופיע בתוך הדף עצמו.
 */
export function DeleteButton({ entity, id }: { entity: string; id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

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
    <span className="flex items-center gap-3 text-small">
      <span role="alert">למחוק לצמיתות?</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => deleteEntity(entity, id))}
        className="font-semibold text-burgundy underline underline-offset-4"
      >
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
  );
}
