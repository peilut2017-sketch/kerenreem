'use client';

import { useMemo, useState, useTransition } from 'react';
import { staffAdjustStock } from '@/lib/admin/orders-actions';
import type { InventoryRow } from '@/lib/admin/commerce-queries';

const MOVE_TYPES = [
  ['receive', 'קליטת מלאי'],
  ['return_restock', 'החזרה למלאי'],
  ['manual_adjust', 'תיקון ידני'],
  ['count', 'ספירת מלאי'],
  ['damage', 'נזק (הורדה)'],
] as const;

/** טבלת המלאי + טופס תנועה מהיר לשורה שנבחרה. */
export function InventoryTable({
  rows,
  defaultLowThreshold,
}: {
  rows: InventoryRow[];
  defaultLowThreshold: number;
}) {
  const [query, setQuery] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState('');
  const [moveType, setMoveType] = useState<(typeof MOVE_TYPES)[number][0]>('receive');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim();
    return rows.filter((row) => {
      if (q && !row.title.includes(q) && !(row.sku ?? '').includes(q)) return false;
      if (onlyLow) {
        const threshold = row.lowThreshold ?? defaultLowThreshold;
        if (!(row.isStockManaged && row.available <= threshold)) return false;
      }
      return true;
    });
  }, [rows, query, onlyLow, defaultLowThreshold]);

  function submit() {
    if (!selected || !delta || !reason.trim()) return;
    const signed = moveType === 'damage' ? -Math.abs(Number(delta)) : Number(delta);
    startTransition(async () => {
      const result = await staffAdjustStock({
        bookId: selected.bookId,
        delta: signed,
        moveType,
        reason: reason.trim(),
      });
      setMessage(
        result.ok ? `עודכן. מלאי פיזי חדש: ${result.onHand}` : result.error ?? 'הפעולה נכשלה',
      );
      if (result.ok) {
        setDelta('');
        setReason('');
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_20rem]">
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בשם או במק״ט"
            className="admin-field-input max-w-xs"
          />
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
              className="h-4 w-4"
            />
            רק מלאי נמוך
          </label>
        </div>

        <div className="admin-card admin-table-wrap">
          <table className="admin-table w-full min-w-[40rem] text-small">
            <thead>
              <tr className="border-b border-rule text-caption text-muted">
                <th className="px-4 py-3 text-start">ספר</th>
                <th className="px-4 py-3 text-start">מק״ט</th>
                <th className="px-4 py-3 text-start">מדף</th>
                <th className="px-4 py-3 text-start">פיזי</th>
                <th className="px-4 py-3 text-start">שמור</th>
                <th className="px-4 py-3 text-start">זמין</th>
                <th className="px-4 py-3 text-start" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const threshold = row.lowThreshold ?? defaultLowThreshold;
                const low = row.isStockManaged && row.available <= threshold;
                return (
                  <tr key={row.bookId} className="border-b border-rule/60">
                    <td className="px-4 py-2.5">
                      {row.title}
                      {!row.isStockManaged ? (
                        <span className="ms-2 admin-badge admin-badge-neutral">בלתי מוגבל</span>
                      ) : null}
                    </td>
                    <td dir="ltr" className="px-4 py-2.5 text-muted">{row.sku ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">{row.stockLocation ?? '—'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{row.onHand}</td>
                    <td className="px-4 py-2.5 tabular-nums">{row.reserved}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      <span className={low ? 'admin-badge admin-badge-warning' : ''}>{row.available}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(row);
                          setMessage(null);
                        }}
                        className="admin-btn admin-btn-ghost"
                      >
                        תנועה
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="admin-card px-5 py-4 xl:sticky xl:top-6">
        <h2 className="mb-3 text-small font-bold text-ink">תנועת מלאי</h2>
        {selected ? (
          <div className="space-y-3">
            <p className="text-small text-ink">
              {selected.title}
              <span className="ms-2 text-caption text-muted">
                פיזי {selected.onHand} · שמור {selected.reserved}
              </span>
            </p>
            <select
              value={moveType}
              onChange={(e) => setMoveType(e.target.value as typeof moveType)}
              className="admin-field-input"
            >
              {MOVE_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              dir="ltr"
              placeholder={moveType === 'damage' ? 'כמות (תרד מהמלאי)' : 'כמות (+ להוספה, − להורדה)'}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="admin-field-input"
            />
            <input
              type="text"
              placeholder="סיבה (חובה — נשמרת ב-ledger)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="admin-field-input"
            />
            <button
              type="button"
              disabled={pending || !delta || !reason.trim()}
              onClick={submit}
              className="admin-btn admin-btn-solid"
            >
              רישום התנועה
            </button>
            {message ? (
              <p role="status" className="text-caption text-ink-soft">
                {message}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-small text-muted">בחרו ספר מהרשימה כדי לרשום תנועה.</p>
        )}
      </aside>
    </div>
  );
}
