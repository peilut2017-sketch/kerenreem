'use client';

import { useId, useState, useTransition } from 'react';
import { updateProfileRole } from '@/lib/admin/settings-actions';
import { ROLE_LABELS, ASSIGNABLE_ROLES } from '@/lib/admin/permissions';
import type { UserRole } from '@/lib/supabase/types';

const OPTIONS: UserRole[] = [...ASSIGNABLE_ROLES, 'viewer'];

export function RoleSelect({
  userId,
  role,
  disabled,
  name,
}: {
  userId: string;
  role: UserRole;
  /** מנהל אינו יכול לשנות את התפקיד של עצמו */
  disabled: boolean;
  name: string;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // ה-key מאלץ רינדור מחדש של ה-select עם defaultValue המקורי כשהשמירה
  // נכשלת — אחרת הדפדפן ממשיך להציג תפקיד "חדש" שמעולם לא נשמר.
  const [resetKey, setResetKey] = useState(0);

  return (
    <>
      <label htmlFor={id} className="sr-only">
        תפקיד עבור {name}
      </label>
      <select
        key={resetKey}
        id={id}
        defaultValue={role}
        disabled={disabled || pending}
        onChange={(event) => {
          const next = event.target.value as UserRole;
          setError(null);
          startTransition(async () => {
            const result = await updateProfileRole(userId, next);
            if (!result.ok) {
              setError(result.error ?? 'השמירה נכשלה');
              setResetKey((current) => current + 1);
            }
          });
        }}
        className="field-input max-w-36 py-1.5"
      >
        {OPTIONS.map((value) => (
          <option key={value} value={value}>
            {ROLE_LABELS[value]}
          </option>
        ))}
      </select>
      {error ? (
        <p role="alert" className="mt-1 text-caption text-red-600">
          {error}
        </p>
      ) : null}
    </>
  );
}
