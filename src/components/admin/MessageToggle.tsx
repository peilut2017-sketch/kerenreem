'use client';

import { useTransition } from 'react';
import { setMessageHandled } from '@/lib/admin/settings-actions';

export function MessageToggle({ id, handled }: { id: string; handled: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={handled}
      onClick={() => startTransition(() => setMessageHandled(id, !handled))}
      className={`border px-2.5 py-1 text-caption transition-colors ${
        handled ? 'border-rule-strong text-muted' : 'border-burgundy text-burgundy'
      }`}
    >
      {handled ? 'טופל' : 'לא טופל'}
    </button>
  );
}
