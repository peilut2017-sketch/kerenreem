'use client';

import { useState, useTransition } from 'react';
import { closeServiceRequest, openReturnRequest } from '@/lib/admin/orders-actions';
import type { ServiceRequestRow } from '@/lib/commerce/service-requests';

/**
 * [1.5] בקשות שירות (ביטול/החזרה) על ההזמנה — ישות אמיתית (migration 40)
 * במקום תג cancel-requested שאף פעם לא התנקה. גם פותחת בקשת החזרה ידנית
 * (עדיין אין ערוץ עצמי ללקוח) — התשתית שממנה יודפס טופס ההחזרה בהמשך.
 */

const KIND_LABELS: Record<string, string> = { cancel: 'ביטול', return: 'החזרה' };
const STATUS_LABELS: Record<string, string> = {
  open: 'פתוחה',
  in_progress: 'בטיפול',
  resolved: 'טופלה',
  declined: 'נדחתה',
};
const STATUS_CLASS: Record<string, string> = {
  open: 'admin-badge-warning',
  in_progress: 'admin-badge-warning',
  resolved: 'admin-badge-success',
  declined: 'admin-badge-danger',
};

export function ServiceRequestsPanel({
  orderId,
  requests,
  items,
}: {
  orderId: string;
  requests: ServiceRequestRow[];
  items: { bookId: string; title: string; quantity: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: 'בוצע.', ok: true }
          : { text: result.error ?? 'הפעולה נכשלה', ok: false },
      );
      if (result.ok) onOk?.();
    });
  }

  const open = requests.filter((r) => r.status === 'open' || r.status === 'in_progress');
  const closed = requests.filter((r) => r.status === 'resolved' || r.status === 'declined');
  const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

  return (
    <section className="admin-card px-5 py-4">
      <h2 className="mb-3 text-small font-bold text-ink">בקשות שירות</h2>

      {message ? (
        <p
          role="status"
          className={`mb-3 rounded-[var(--radius-sm)] px-3 py-2 text-caption ${
            message.ok
              ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
              : 'bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]'
          }`}
        >
          {message.ok ? '✓ ' : '⚠ '}
          {message.text}
        </p>
      ) : null}

      {requests.length === 0 ? (
        <p className="text-small text-muted">אין בקשות שירות על ההזמנה הזו.</p>
      ) : (
        <ul className="space-y-2">
          {[...open, ...closed].map((req) => (
            <li
              key={req.id}
              className="rounded-[var(--radius-sm)] border border-[var(--admin-border)] px-3 py-2.5 text-small"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">
                  {KIND_LABELS[req.kind] ?? req.kind}
                  <span className="ms-1.5 text-caption font-normal text-muted">
                    · {req.requested_by === 'customer' ? 'ע״י הלקוח' : 'ע״י הצוות'} ·{' '}
                    {dateFmt.format(new Date(req.created_at))}
                  </span>
                </span>
                <span className={`admin-badge ${STATUS_CLASS[req.status] ?? ''}`}>
                  {STATUS_LABELS[req.status] ?? req.status}
                </span>
              </div>
              {req.reason ? <p className="mt-1 text-caption text-ink-soft">“{req.reason}”</p> : null}
              {req.items && req.items.length > 0 ? (
                <ul className="mt-1 text-caption text-ink-soft">
                  {req.items.map((it) => (
                    <li key={it.bookId}>
                      {it.title} × {it.quantity}
                    </li>
                  ))}
                </ul>
              ) : null}
              {req.resolution_note ? (
                <p className="mt-1 text-caption text-muted">הערת טיפול: {req.resolution_note}</p>
              ) : null}
              {req.kind === 'return' ? (
                <a
                  href={`/admin/orders/${orderId}/print/return-form/${req.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-caption text-[var(--admin-accent)] underline"
                >
                  הדפסת טופס החזרה
                </a>
              ) : null}
              {req.status === 'open' || req.status === 'in_progress' ? (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const note = window.prompt('הערת טיפול (רשות):');
                      if (note === null) return;
                      run(() => closeServiceRequest(req.id, 'resolved', note));
                    }}
                    className="admin-btn admin-btn-quiet"
                  >
                    סימון כטופלה
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const note = window.prompt('סיבת הדחייה?');
                      if (note === null) return;
                      run(() => closeServiceRequest(req.id, 'declined', note));
                    }}
                    className="admin-btn admin-btn-ghost"
                  >
                    דחייה
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 ? (
        showReturnForm ? (
          <div className="mt-4 space-y-2 border-t border-rule pt-3">
            <p className="text-caption font-semibold text-ink">פתיחת בקשת החזרה</p>
            <ul className="space-y-1.5">
              {items.map((item) => (
                <li key={item.bookId} className="flex items-center justify-between gap-2 text-small">
                  <span className="min-w-0 truncate text-ink">{item.title}</span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    max={item.quantity}
                    value={selected[item.bookId] ?? 0}
                    aria-label={`כמות להחזרה — ${item.title}`}
                    onChange={(e) =>
                      setSelected((s) => ({
                        ...s,
                        [item.bookId]: Math.max(0, Math.min(item.quantity, Number(e.target.value) || 0)),
                      }))
                    }
                    className="admin-field-input w-16 py-1 text-center"
                  />
                </li>
              ))}
            </ul>
            <input
              type="text"
              placeholder="סיבת ההחזרה"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="admin-field-input"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending || !reason.trim() || Object.values(selected).every((q) => !q)}
                onClick={() =>
                  run(
                    () =>
                      openReturnRequest(
                        orderId,
                        reason,
                        items
                          .filter((item) => (selected[item.bookId] ?? 0) > 0)
                          .map((item) => ({
                            bookId: item.bookId,
                            title: item.title,
                            quantity: selected[item.bookId],
                          })),
                      ),
                    () => {
                      setShowReturnForm(false);
                      setSelected({});
                      setReason('');
                    },
                  )
                }
                className="admin-btn admin-btn-solid"
              >
                פתיחת הבקשה
              </button>
              <button type="button" onClick={() => setShowReturnForm(false)} className="admin-btn admin-btn-quiet">
                ביטול
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowReturnForm(true)} className="admin-btn admin-btn-quiet mt-3">
            פתיחת בקשת החזרה
          </button>
        )
      ) : null}
    </section>
  );
}
