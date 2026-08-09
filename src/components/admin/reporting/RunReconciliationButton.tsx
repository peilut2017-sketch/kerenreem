'use client';

import { useState, useTransition } from 'react';
import { runReconciliationNow } from '@/lib/admin/reporting-actions';

export function RunReconciliationButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function run() {
    startTransition(async () => {
      const result = await runReconciliationNow();
      setMessage(
        result.ok
          ? { text: `נבדקו ${result.checked} תשלומים, ${result.mismatched} פערים.`, ok: true }
          : { text: result.error, ok: false },
      );
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} onClick={run} className="admin-btn admin-btn-quiet">
        {pending ? 'בודק מול מורנינג…' : 'הרצת התאמה עכשיו'}
      </button>
      {message ? (
        <p role="status" className={`text-caption ${message.ok ? 'text-[var(--admin-success)]' : 'text-[var(--admin-danger)]'}`}>
          {message.ok ? '✓ ' : '⚠ '}
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
