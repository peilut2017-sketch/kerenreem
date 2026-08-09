'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  createStockLocation,
  staffAdjustStock,
  staffTransferStock,
} from '@/lib/admin/orders-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';
import type { InventoryRow, StockLocationRow } from '@/lib/admin/commerce-queries';

const MOVE_TYPES = [
  ['receive', 'קליטת מלאי'],
  ['return_restock', 'החזרה למלאי'],
  ['manual_adjust', 'תיקון ידני'],
  ['count', 'ספירת מלאי'],
  ['damage', 'נזק (הורדה)'],
] as const;

const LOCATION_KINDS = [
  ['warehouse', 'מחסן'],
  ['office', 'משרד'],
  ['pickup_point', 'נקודת איסוף'],
  ['distributor', 'מפיץ'],
  ['temp', 'זמני'],
] as const;

/**
 * מסך המלאי הרב-מחסני (הכרעה 9): טבלה עם פירוט פר מיקום, תנועה מנומקת
 * למיקום נבחר, העברה אטומית בין מחסנים וניהול המיקומים עצמם. כל שינוי
 * כמות הוא תנועת ledger — לעולם לא כתיבה ישירה.
 */
export function InventoryTable({
  rows,
  locations,
  defaultLowThreshold,
  canManageLocations,
}: {
  rows: InventoryRow[];
  locations: StockLocationRow[];
  defaultLowThreshold: number;
  canManageLocations: boolean;
}) {
  const [query, setQuery] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [panelTab, setPanelTab] = useState<'move' | 'transfer'>('move');
  const [delta, setDelta] = useState('');
  const [moveType, setMoveType] = useState<(typeof MOVE_TYPES)[number][0]>('receive');
  const [reason, setReason] = useState('');
  const [locationId, setLocationId] = useState<string>('');
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [transferQty, setTransferQty] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationKind, setNewLocationKind] =
    useState<(typeof LOCATION_KINDS)[number][0]>('warehouse');
  const [showLocations, setShowLocations] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const activeLocations = locations.filter((loc) => loc.active);
  const defaultLocation = activeLocations.find((loc) => loc.isDefault) ?? activeLocations[0];
  const multiLocation = activeLocations.length > 1;

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

  function submitMove() {
    if (!selected || !delta || !reason.trim()) return;
    const signed = moveType === 'damage' ? -Math.abs(Number(delta)) : Number(delta);
    startTransition(async () => {
      const result = await staffAdjustStock({
        bookId: selected.bookId,
        delta: signed,
        moveType,
        reason: reason.trim(),
        locationId: locationId || defaultLocation?.id || null,
      });
      setMessage(
        result.ok ? `עודכן. מלאי פיזי חדש במיקום: ${result.onHand}` : (result.error ?? 'הפעולה נכשלה'),
      );
      if (result.ok) {
        setDelta('');
        setReason('');
      }
    });
  }

  function submitTransfer() {
    if (!selected || !fromLocation || !toLocation || !transferQty) return;
    startTransition(async () => {
      const result = await staffTransferStock({
        bookId: selected.bookId,
        fromLocationId: fromLocation,
        toLocationId: toLocation,
        qty: Math.abs(Number(transferQty)),
      });
      setMessage(result.ok ? 'ההעברה נרשמה (יציאה + כניסה ב-ledger).' : (result.error ?? 'ההעברה נכשלה'));
      if (result.ok) setTransferQty('');
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_21rem]">
      <div>
        {/* סרגל: חיפוש, סינון, מיקומים */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <AdminIcon
              name="search"
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בשם או במק״ט"
              className="admin-field-input w-64 ps-9"
            />
          </div>
          <label className="flex items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
              className="h-4 w-4"
            />
            רק מלאי נמוך
          </label>
          <span className="ms-auto inline-flex items-center gap-1.5 text-caption text-muted">
            <AdminIcon name="warehouse" className="h-4 w-4" />
            {activeLocations.length} מיקומים
          </span>
          {canManageLocations ? (
            <button
              type="button"
              onClick={() => setShowLocations((v) => !v)}
              aria-expanded={showLocations}
              className="admin-btn admin-btn-ghost"
            >
              ניהול מיקומים
            </button>
          ) : null}
        </div>

        {/* ניהול מיקומים */}
        {showLocations ? (
          <div className="admin-card mb-4 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <span
                  key={loc.id}
                  className={`admin-badge ${loc.active ? 'admin-badge-neutral' : 'opacity-50'}`}
                >
                  <AdminIcon name="warehouse" className="h-3.5 w-3.5" />
                  {loc.name}
                  {loc.isDefault ? ' · ראשי' : ''}
                </span>
              ))}
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!newLocationName.trim()) return;
                startTransition(async () => {
                  const result = await createStockLocation({
                    name: newLocationName,
                    kind: newLocationKind,
                  });
                  setMessage(result.ok ? 'המיקום נוסף.' : (result.error ?? 'הוספת המיקום נכשלה'));
                  if (result.ok) setNewLocationName('');
                });
              }}
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--admin-border)] pt-4"
            >
              <div>
                <label htmlFor="loc-name" className="field-label">
                  מיקום חדש
                </label>
                <input
                  id="loc-name"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder='למשל "מחסן בני ברק"'
                  className="admin-field-input w-56"
                />
              </div>
              <select
                aria-label="סוג מיקום"
                value={newLocationKind}
                onChange={(e) => setNewLocationKind(e.target.value as typeof newLocationKind)}
                className="admin-field-input w-40"
              >
                {LOCATION_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={pending} className="admin-btn admin-btn-solid">
                <AdminIcon name="plus" className="h-4 w-4" />
                הוספה
              </button>
            </form>
          </div>
        ) : null}

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
                const isExpanded = expanded === row.bookId;
                return (
                  <FragmentRow key={row.bookId}>
                    <tr className="border-b border-rule/60">
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          {multiLocation && row.perLocation.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpanded(isExpanded ? null : row.bookId)}
                              aria-expanded={isExpanded}
                              aria-label={`פירוט מיקומים עבור ${row.title}`}
                              className="text-muted transition-transform duration-200"
                              style={{ transform: isExpanded ? 'rotate(180deg)' : undefined }}
                            >
                              <AdminIcon name="chevron-down" className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                          {row.title}
                          {!row.isStockManaged ? (
                            <span className="admin-badge admin-badge-neutral">בלתי מוגבל</span>
                          ) : null}
                        </span>
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
                            setPanelTab('move');
                            setLocationId(defaultLocation?.id ?? '');
                            setFromLocation(row.perLocation[0]?.locationId ?? defaultLocation?.id ?? '');
                            setToLocation('');
                          }}
                          className="admin-btn admin-btn-ghost"
                        >
                          תנועה
                        </button>
                      </td>
                    </tr>
                    {isExpanded
                      ? row.perLocation.map((level) => (
                          <tr key={level.locationId} className="border-b border-rule/40 bg-cream-2/50">
                            <td className="px-4 py-1.5 ps-12 text-caption text-muted" colSpan={3}>
                              <span className="inline-flex items-center gap-1.5">
                                <AdminIcon name="warehouse" className="h-3.5 w-3.5" />
                                {level.locationName}
                              </span>
                            </td>
                            <td className="px-4 py-1.5 text-caption tabular-nums text-muted">{level.onHand}</td>
                            <td className="px-4 py-1.5 text-caption tabular-nums text-muted">{level.reserved}</td>
                            <td className="px-4 py-1.5 text-caption tabular-nums text-muted">
                              {level.onHand - level.reserved}
                            </td>
                            <td />
                          </tr>
                        ))
                      : null}
                  </FragmentRow>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="admin-card px-5 py-4 xl:sticky xl:top-6">
        {selected ? (
          <div className="space-y-3">
            <p className="text-small font-semibold text-ink">
              {selected.title}
              <span className="ms-2 font-normal text-caption text-muted">
                פיזי {selected.onHand} · שמור {selected.reserved}
              </span>
            </p>

            {multiLocation ? (
              <div
                role="tablist"
                aria-label="סוג פעולה"
                className="flex rounded-[10px] bg-cream-2 p-1 text-small"
              >
                {(
                  [
                    ['move', 'תנועה'],
                    ['transfer', 'העברה בין מחסנים'],
                  ] as const
                ).map(([tab, label]) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={panelTab === tab}
                    type="button"
                    onClick={() => setPanelTab(tab)}
                    className={`flex-1 rounded-[8px] px-3 py-1.5 transition-colors ${
                      panelTab === tab ? 'bg-white font-semibold text-ink shadow-sm' : 'text-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="text-small font-bold text-ink">תנועת מלאי</h2>
            )}

            {panelTab === 'move' ? (
              <>
                {multiLocation ? (
                  <select
                    aria-label="מיקום"
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="admin-field-input"
                  >
                    {activeLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                        {loc.isDefault ? ' (ראשי)' : ''}
                      </option>
                    ))}
                  </select>
                ) : null}
                <select
                  aria-label="סוג תנועה"
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
                  onClick={submitMove}
                  className="admin-btn admin-btn-solid w-full"
                >
                  רישום התנועה
                </button>
              </>
            ) : (
              <>
                <select
                  aria-label="ממיקום"
                  value={fromLocation}
                  onChange={(e) => setFromLocation(e.target.value)}
                  className="admin-field-input"
                >
                  <option value="">ממיקום…</option>
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      מ: {loc.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="למיקום"
                  value={toLocation}
                  onChange={(e) => setToLocation(e.target.value)}
                  className="admin-field-input"
                >
                  <option value="">למיקום…</option>
                  {activeLocations
                    .filter((loc) => loc.id !== fromLocation)
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        אל: {loc.name}
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  dir="ltr"
                  min={1}
                  placeholder="כמות להעברה"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="admin-field-input"
                />
                <button
                  type="button"
                  disabled={pending || !fromLocation || !toLocation || !transferQty}
                  onClick={submitTransfer}
                  className="admin-btn admin-btn-solid w-full"
                >
                  <AdminIcon name="transfer" className="h-4 w-4" />
                  ביצוע העברה
                </button>
              </>
            )}

            {message ? (
              <p role="status" className="text-caption text-ink-soft">
                {message}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-small text-muted">בחרו ספר מהרשימה כדי לרשום תנועה או העברה.</p>
        )}
      </aside>
    </div>
  );
}

/** עוטף שורת טבלה + שורות פירוט — React דורש מפתח על האב המשותף. */
function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
