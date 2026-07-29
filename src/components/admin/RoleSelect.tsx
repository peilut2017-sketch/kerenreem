'use client';

import { useId, useTransition } from 'react';
import { updateProfileRole } from '@/lib/admin/settings-actions';
import type { UserRole } from '@/lib/supabase/types';

const OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'viewer', label: 'צופה' },
  { value: 'editor', label: 'עורך' },
  { value: 'admin', label: 'מנהל' },
];

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

  return (
    <>
      <label htmlFor={id} className="sr-only">
        תפקיד עבור {name}
      </label>
      <select
        id={id}
        defaultValue={role}
        disabled={disabled || pending}
        onChange={(event) => {
          const next = event.target.value as UserRole;
          startTransition(() => updateProfileRole(userId, next));
        }}
        className="field-input max-w-36 py-1.5"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
