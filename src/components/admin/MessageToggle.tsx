'use client';

import { useState, useTransition } from 'react';
import { setMessageHandled } from '@/lib/admin/messages-actions';

export function MessageToggle({
  id,
  handled,
  className = 'border px-2.5 py-1 text-caption transition-colors',
}: {
  id: string;
  handled: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span>
      <button
        type="button"
        disabled={pending}
        aria-pressed={handled}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await setMessageHandled(id, !handled);
            if (result?.error) setError(result.error);
          })
        }
        className={`${className} ${handled ? 'border-rule-strong text-muted' : 'border-burgundy text-burgundy'}`}
      >
        {handled ? 'טופל' : 'לא טופל'}
      </button>
      {error ? (
        <span role="alert" className="ms-2 text-caption text-[var(--admin-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
