'use client';

import { useState, useTransition } from 'react';
import {
  addOrderNote,
  addTracking,
  markManualPayment,
  refundOrder,
  resendOrderEmail,
  staffTransitionOrder,
} from '@/lib/admin/orders-actions';
import {
  FULFILLMENT_STATE_TRANSITIONS,
  ORDER_STATE_TRANSITIONS,
} from '@/lib/commerce/state-machines';
import { FULFILLMENT_STATE_LABELS, ORDER_STATE_LABELS } from './labels';
import type { FulfillmentState, OrderState } from '@/lib/supabase/types';

/**
 * לוח הפעולות בעמוד ההזמנה: רק מעברים חוקיים מהמצב הנוכחי מוצעים;
 * פעולות כספיות (תשלום ידני, זיכוי) — admin בלבד, עם אישור כפול.
 * משלוח חלקי חסום בממשק (החלטה 13) — partially_fulfilled מסונן.
 */
export function OrderActionsPanel({
  order,
  isAdmin,
}: {
  order: {
    id: string;
    state: OrderState;
    paymentState: string;
    fulfillmentState: FulfillmentState;
    total: number;
    refundable: number;
  };
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState({ company: '', trackingNumber: '', trackingUrl: '' });
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');

  function run(action: () => Promise<{ ok: boolean; error?: string }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      setMessage(result.ok ? 'בוצע.' : result.error ?? 'הפעולה נכשלה');
    });
  }

  const stateTargets = (ORDER_STATE_TRANSITIONS[order.state] ?? []).filter(
    (target) => target !== 'cancelled',
  );
  const fulfillmentTargets = (FULFILLMENT_STATE_TRANSITIONS[order.fulfillmentState] ?? []).filter(
    (target) => target !== 'partially_fulfilled' && target !== 'shipped',
  );

  return (
    <aside className="space-y-5 xl:sticky xl:top-6">
      <section className="admin-card px-5 py-4">
        <h2 className="mb-3 text-small font-bold text-ink">פעולות</h2>

        {message ? (
          <p role="status" className="mb-3 rounded-[var(--radius-sm)] bg-cream-2 px-3 py-2 text-caption text-ink">
            {message}
          </p>
        ) : null}

        {/* מעברי ציר ההזמנה */}
        {stateTargets.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {stateTargets.map((target) => (
              <button
                key={target}
                type="button"
                disabled={pending}
                onClick={() => run(() => staffTransitionOrder(order.id, 'state', target))}
                className="admin-btn admin-btn-quiet"
              >
                {ORDER_STATE_LABELS[target]}
              </button>
            ))}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => staffTransitionOrder(order.id, 'state', 'cancelled'),
                  'לבטל את ההזמנה? אם שולמה — יש לבצע זיכוי בנפרד.',
                )
              }
              className="admin-btn admin-btn-danger"
            >
              ביטול הזמנה
            </button>
          </div>
        ) : null}

        {/* מעברי ציר האספקה */}
        {fulfillmentTargets.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {fulfillmentTargets.map((target) => (
              <button
                key={target}
                type="button"
                disabled={pending}
                onClick={() => run(() => staffTransitionOrder(order.id, 'fulfillment_state', target))}
                className="admin-btn admin-btn-quiet"
              >
                {FULFILLMENT_STATE_LABELS[target]}
              </button>
            ))}
          </div>
        ) : null}

        {/* משלוח: חברת שילוח + מספר מעקב ⇒ shipped + מייל */}
        {['preparing', 'unfulfilled'].includes(order.fulfillmentState) ? (
          <div className="mb-4 space-y-2 border-t border-rule pt-3">
            <p className="text-caption font-semibold text-ink">מסירה לשליח</p>
            <input
              type="text"
              placeholder="חברת משלוחים"
              value={tracking.company}
              onChange={(e) => setTracking((v) => ({ ...v, company: e.target.value }))}
              className="admin-field-input"
            />
            <input
              type="text"
              dir="ltr"
              placeholder="מספר מעקב"
              value={tracking.trackingNumber}
              onChange={(e) => setTracking((v) => ({ ...v, trackingNumber: e.target.value }))}
              className="admin-field-input"
            />
            <input
              type="url"
              dir="ltr"
              placeholder="קישור מעקב (רשות)"
              value={tracking.trackingUrl}
              onChange={(e) => setTracking((v) => ({ ...v, trackingUrl: e.target.value }))}
              className="admin-field-input"
            />
            <button
              type="button"
              disabled={pending || !tracking.company || !tracking.trackingNumber}
              onClick={() =>
                run(() =>
                  addTracking(order.id, {
                    company: tracking.company,
                    trackingNumber: tracking.trackingNumber,
                    trackingUrl: tracking.trackingUrl || undefined,
                  }),
                )
              }
              className="admin-btn admin-btn-solid"
            >
              נמסר לשליח + מייל ללקוח
            </button>
          </div>
        ) : null}

        {/* פעולות כספיות — admin בלבד */}
        {isAdmin && order.paymentState === 'pending' ? (
          <div className="mb-4 border-t border-rule pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => markManualPayment(order.id),
                  'לסמן שהתשלום התקבל מחוץ לאתר? הפעולה מתועדת ב-audit.',
                )
              }
              className="admin-btn admin-btn-quiet"
            >
              סימון תשלום חיצוני
            </button>
          </div>
        ) : null}

        {isAdmin && order.refundable > 0 ? (
          <div className="mb-2 space-y-2 border-t border-rule pt-3">
            <p className="text-caption font-semibold text-ink">
              זיכוי (עד {order.refundable.toFixed(2)} ₪)
            </p>
            <input
              type="number"
              dir="ltr"
              min={0.01}
              max={order.refundable}
              step={0.01}
              placeholder="סכום"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="admin-field-input"
            />
            <input
              type="text"
              placeholder="סיבה"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="admin-field-input"
            />
            <button
              type="button"
              disabled={pending || !refundAmount || !refundReason}
              onClick={() =>
                run(
                  () => refundOrder(order.id, Number(refundAmount), refundReason),
                  `לבצע זיכוי של ${refundAmount} ₪ דרך מורנינג? פעולה בלתי הפיכה.`,
                )
              }
              className="admin-btn admin-btn-danger"
            >
              ביצוע זיכוי
            </button>
          </div>
        ) : null}
      </section>

      {/* הערה פנימית */}
      <section className="admin-card px-5 py-4">
        <h2 className="mb-2 text-small font-bold text-ink">הערה פנימית</h2>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="admin-field-input"
        />
        <button
          type="button"
          disabled={pending || !note.trim()}
          onClick={() =>
            run(async () => {
              const result = await addOrderNote(order.id, note);
              if (result.ok) setNote('');
              return result;
            })
          }
          className="admin-btn admin-btn-quiet mt-2"
        >
          הוספה לציר הזמן
        </button>
      </section>

      {/* שליחה חוזרת של מיילים */}
      <section className="admin-card px-5 py-4">
        <h2 className="mb-2 text-small font-bold text-ink">שליחה חוזרת של מייל</h2>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['order_confirmation', 'אישור הזמנה'],
              ['payment_received', 'אישור תשלום'],
              ['shipped', 'נשלח'],
              ['ready_for_pickup', 'מוכן לאיסוף'],
            ] as const
          ).map(([template, label]) => (
            <button
              key={template}
              type="button"
              disabled={pending}
              onClick={() => run(() => resendOrderEmail(order.id, template))}
              className="admin-btn admin-btn-ghost"
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
