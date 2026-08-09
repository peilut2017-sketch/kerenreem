'use client';

import { useState, useTransition } from 'react';
import { editOrderItems, savePickingState, setStaffDiscount } from '@/lib/admin/orders-actions';
import { AdminIcon } from '@/components/admin/AdminIcons';

export interface PickableItem {
  id: string;
  title: string;
  quantity: number;
  picked: number | null;
}

/**
 * [1.3] פאנל הליקוט והעריכה בעמוד ההזמנה:
 * - ליקוט: סימון כמה לוקט מכל פריט + הערת מלקט; מותר "נארזה" גם בליקוט
 *   חלקי (מחסור) — מייל "נשלחה" יפרט מה נשלח בפועל.
 * - עריכה (עד תשלום): שינוי כמויות/הסרה עם סיבה חובה + מייל עדכון.
 * - הנחת צוות מנומקת (עד תשלום) — "עריכת החשבונית".
 */
export function PickingPanel({
  orderId,
  items,
  packingNote,
  canEdit,
  canDiscount,
  editable,
  staffDiscount,
}: {
  orderId: string;
  items: PickableItem[];
  packingNote: string | null;
  /** עריכת פריטים — עד תשלום ועד אריזה */
  canEdit: boolean;
  canDiscount: boolean;
  editable: boolean;
  staffDiscount: number;
}) {
  const [picked, setPicked] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, item.picked != null ? String(item.picked) : ''])),
  );
  const [note, setNote] = useState(packingNote ?? '');
  const [editQty, setEditQty] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, String(item.quantity)])),
  );
  const [editReason, setEditReason] = useState('');
  const [discount, setDiscount] = useState(staffDiscount > 0 ? String(staffDiscount) : '');
  const [discountReason, setDiscountReason] = useState('');
  const [tab, setTab] = useState<'pick' | 'edit'>('pick');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allPicked = items.every(
    (item) => picked[item.id] !== '' && Number(picked[item.id]) >= item.quantity,
  );

  return (
    <section className="admin-card px-5 py-4">
      <div role="tablist" aria-label="ליקוט ועריכה" className="mb-4 flex rounded-[10px] bg-cream-2 p-1 text-small">
        <button
          role="tab"
          aria-selected={tab === 'pick'}
          type="button"
          onClick={() => setTab('pick')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 transition-colors ${tab === 'pick' ? 'bg-white font-semibold text-ink shadow-sm' : 'text-muted'}`}
        >
          <AdminIcon name="inventory" className="h-4 w-4" />
          ליקוט ואריזה
        </button>
        {canEdit ? (
          <button
            role="tab"
            aria-selected={tab === 'edit'}
            type="button"
            onClick={() => setTab('edit')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-1.5 transition-colors ${tab === 'edit' ? 'bg-white font-semibold text-ink shadow-sm' : 'text-muted'}`}
          >
            <AdminIcon name="edit" className="h-4 w-4" />
            עריכת ההזמנה
          </button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="mb-3 rounded-[8px] bg-cream-2 px-3 py-2 text-caption text-ink">{message}</p>
      ) : null}

      {tab === 'pick' ? (
        <div className="space-y-3">
          <ul className="divide-y divide-[var(--admin-border)]">
            {items.map((item) => {
              const value = picked[item.id] ?? '';
              const full = value !== '' && Number(value) >= item.quantity;
              const partial = value !== '' && Number(value) > 0 && Number(value) < item.quantity;
              return (
                <li key={item.id} className="flex items-center gap-3 py-2.5 text-small">
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                      full
                        ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
                        : partial
                          ? 'bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]'
                          : 'bg-cream-2 text-muted'
                    }`}
                  >
                    {full ? '✓' : partial ? '!' : '·'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
                  <span className="text-caption text-muted">מתוך {item.quantity}</span>
                  <input
                    type="number"
                    dir="ltr"
                    min={0}
                    max={item.quantity}
                    value={value}
                    aria-label={`לוקט — ${item.title}`}
                    placeholder="0"
                    onChange={(e) => setPicked((v) => ({ ...v, [item.id]: e.target.value }))}
                    className="admin-field-input w-20 py-1.5 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setPicked((v) => ({ ...v, [item.id]: String(item.quantity) }))}
                    className="admin-btn admin-btn-ghost admin-btn-icon"
                    aria-label={`הכל לוקט — ${item.title}`}
                    title="הכל לוקט"
                  >
                    <AdminIcon name="check" className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div>
            <label htmlFor="packing-note" className="admin-field-label">
              הערת מלקט (רשות — למשל למה לא לוקט הכל)
            </label>
            <input
              id="packing-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="admin-field-input"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await savePickingState(
                  orderId,
                  items.map((item) => ({
                    itemId: item.id,
                    pickedQuantity: Number(picked[item.id] || 0),
                  })),
                  note,
                );
                setMessage(
                  result.ok
                    ? allPicked
                      ? 'הליקוט נשמר — הכל לוקט. אפשר לסמן נארזה/נשלחה בפעולות.'
                      : 'הליקוט נשמר (חלקי). אפשר להמשיך לאריזה — מייל המשלוח יפרט מה נשלח.'
                    : (result.error ?? 'השמירה נכשלה'),
                );
              })
            }
            className="admin-btn admin-btn-solid w-full"
          >
            שמירת מצב הליקוט
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {!editable ? (
            <p className="rounded-[8px] bg-[var(--admin-warning-soft)] px-3 py-2.5 text-caption text-[var(--admin-warning)]">
              ההזמנה שולמה או נארזה — שינוי פריטים דרך זיכוי בלבד.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--admin-border)]">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5 text-small">
                    <span className="min-w-0 flex-1 truncate text-ink">{item.title}</span>
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={editQty[item.id] ?? ''}
                      aria-label={`כמות — ${item.title}`}
                      onChange={(e) => setEditQty((v) => ({ ...v, [item.id]: e.target.value }))}
                      className="admin-field-input w-20 py-1.5 text-center"
                    />
                  </li>
                ))}
              </ul>
              <input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="סיבת העריכה (חובה — נשלחת ללקוח במייל)"
                className="admin-field-input"
              />
              <button
                type="button"
                disabled={pending || !editReason.trim()}
                onClick={() =>
                  startTransition(async () => {
                    const result = await editOrderItems(
                      orderId,
                      items.map((item) => ({
                        itemId: item.id,
                        quantity: Number(editQty[item.id] || 0),
                      })),
                      editReason,
                    );
                    setMessage(result.ok ? 'ההזמנה עודכנה ונשלח מייל ללקוח.' : (result.error ?? 'העריכה נכשלה'));
                  })
                }
                className="admin-btn admin-btn-solid w-full"
              >
                שמירת השינויים + מייל ללקוח
              </button>

              {canDiscount ? (
                <div className="space-y-2 border-t border-[var(--admin-border)] pt-3">
                  <p className="text-caption font-semibold text-ink">שורת הנחה על החשבון (עד התשלום)</p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      step={0.5}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder='הנחה בש"ח'
                      className="admin-field-input"
                    />
                    <input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="סיבה"
                      className="admin-field-input"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={pending || (Number(discount) > 0 && !discountReason.trim())}
                    onClick={() =>
                      startTransition(async () => {
                        const result = await setStaffDiscount(orderId, Number(discount || 0), discountReason);
                        setMessage(result.ok ? 'ההנחה נשמרה והחשבון עודכן.' : (result.error ?? 'נכשל'));
                      })
                    }
                    className="admin-btn admin-btn-quiet"
                  >
                    עדכון החשבון
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
