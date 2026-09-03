'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addOrderNote,
  addTracking,
  cancelOrder,
  deleteOrder,
  markManualPayment,
  sendPaymentLink,
  resendOrderEmail,
  setActualShippingCost,
  staffTransitionOrder,
  undoManualPayment,
  undoShipment,
} from '@/lib/admin/orders-actions';
import { CardPaymentDrawer } from './CardPaymentDrawer';
import { RefundDialog, type RefundableItem } from './RefundDialog';
import {
  FULFILLMENT_STATE_TRANSITIONS,
  ORDER_STATE_TRANSITIONS,
} from '@/lib/commerce/state-machines';
import { FULFILLMENT_STATE_LABELS, ORDER_STATE_LABELS } from './labels';
import type { FulfillmentState, OrderState } from '@/lib/supabase/types';

/**
 * [1.6] פעולה ראשית תלויית-מצב (ביקורת ג.20/י.4): לא "קיר כפתורים
 * שווי-משקל" עם תוויות שם-עצם ("בהכנה", "מוכן לאיסוף") אלא פועל בודד,
 * מנוסח כפעולה, לצעד הבא הברור ביותר. שני מצבי האספקה שיש להם צעד הבא
 * חד-משמעי (unfulfilled, ready_for_pickup — לכל אחד יעד מעברים יחיד
 * במכונת המצבים) מקבלים כפתור ראשי; preparing תלוי בשיטת האספקה: איסוף
 * עצמי ⇐ "מוכן לאיסוף" ראשי, משלוח ⇐ אין כפתור מצב כללי כי הצעד הבא
 * האמיתי הוא מילוי טופס המסירה לשליח למטה (שכבר מעוצב כפעולה ראשית).
 */
function primaryFulfillmentAction(
  fulfillmentState: FulfillmentState,
  isPickup: boolean,
): { label: string; target: FulfillmentState } | null {
  if (fulfillmentState === 'unfulfilled') return { label: 'התחלת הכנה', target: 'preparing' };
  if (fulfillmentState === 'preparing' && isPickup) {
    return { label: 'מוכן לאיסוף — עדכון ומייל ללקוח', target: 'ready_for_pickup' };
  }
  if (fulfillmentState === 'ready_for_pickup') return { label: 'נאסף על ידי הלקוח', target: 'fulfilled' };
  return null;
}

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
    documentState: string;
    total: number;
    refundable: number;
    actualShippingCost?: number | null;
    items: RefundableItem[];
    shippingTotal: number;
    isPickup: boolean;
  };
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; ok: boolean; undo?: () => void } | null>(null);
  const [note, setNote] = useState('');
  const [tracking, setTracking] = useState({ company: '', trackingNumber: '', trackingUrl: '' });
  const [actualShipping, setActualShipping] = useState(
    order.actualShippingCost != null ? String(order.actualShippingCost) : '',
  );

  // [1.5] "הודעה אחרי כל פעולה — בוטל, לחצו לשחזור": run() מקבל בנוסף
  // פעולת-ביטול אופציונלית שמוצגת צמודה להודעת ההצלחה. משתמש רק בפעולות
  // שיש להן היפוך אמיתי ובטוח (בדוק/מתועד בשרת) — לא כל פעולה הפיכה.
  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    confirmText?: string,
    undoAction?: () => void,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.ok
          ? { text: 'בוצע.', ok: true, undo: undoAction }
          : { text: result.error ?? 'הפעולה נכשלה', ok: false },
      );
    });
  }

  function promptAndUndo(
    promptText: string,
    action: (reason: string) => Promise<{ ok: boolean; error?: string }>,
  ) {
    const reason = window.prompt(promptText);
    if (reason === null) return;
    run(() => action(reason.trim() || 'ללא סיבה'));
  }

  // ביטול אינו מוצע כמעבר רגיל — יש לו זרימה משלו (תרשים 13 המתוקן)
  const stateTargets = (ORDER_STATE_TRANSITIONS[order.state] ?? []).filter(
    (target) => target !== 'cancelled' && target !== 'cancel_pending_refund',
  );
  const paidNeedsRefund = ['paid', 'partially_refunded'].includes(order.paymentState);
  const awaitingRefund = order.state === 'cancel_pending_refund';
  const primaryFulfillment = primaryFulfillmentAction(order.fulfillmentState, order.isPickup);
  const fulfillmentTargets = (FULFILLMENT_STATE_TRANSITIONS[order.fulfillmentState] ?? []).filter(
    (target) =>
      target !== 'partially_fulfilled' &&
      target !== 'shipped' &&
      target !== primaryFulfillment?.target &&
      (order.isPickup || target !== 'ready_for_pickup'),
  );

  return (
    <aside className="space-y-5 xl:sticky xl:top-6">
      <section className="admin-card px-5 py-4">
        <h2 className="mb-3 text-small font-bold text-ink">פעולות</h2>

        {message ? (
          <p
            role={message.ok ? 'status' : 'alert'}
            className={`mb-3 flex flex-wrap items-center gap-x-2 rounded-[var(--radius-sm)] px-3 py-2 text-caption ${
              message.ok
                ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
                : 'bg-[var(--admin-danger-soft)] text-[var(--admin-danger)]'
            }`}
          >
            <span>
              {message.ok ? '✓ ' : '⚠ '}
              {message.text}
            </span>
            {message.undo ? (
              <button
                type="button"
                onClick={message.undo}
                className="font-semibold underline decoration-dotted"
              >
                לחצו לביטול
              </button>
            ) : null}
          </p>
        ) : null}

        {/* [1.5] ביטול פעולה שבוצעה בטעות — לא מעבר-סטטוס כללי, רק שני
            התיקונים הנפוצים שאין להם דרך חזרה במכונת המצבים הרגילה */}
        {isAdmin &&
        order.paymentState === 'paid' &&
        order.fulfillmentState === 'unfulfilled' &&
        ['not_created', 'pending'].includes(order.documentState) ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--admin-border)] px-3 py-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                promptAndUndo('סיבת ביטול סימון התשלום? (לתיעוד בציר הזמן)', (reason) =>
                  undoManualPayment(order.id, reason),
                )
              }
              className="text-caption font-semibold text-muted underline decoration-dotted hover:text-[var(--admin-danger)]"
            >
              ↩ בטלתי בטעות — ביטול סימון תשלום ידני
            </button>
          </div>
        ) : null}
        {order.fulfillmentState === 'shipped' ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--admin-border)] px-3 py-2.5">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                promptAndUndo(
                  'סיבת ביטול סימון המשלוח? שימו לב: מייל "נשלח" שכבר יצא ללקוח לא יבוטל.',
                  (reason) => undoShipment(order.id, reason),
                )
              }
              className="text-caption font-semibold text-muted underline decoration-dotted hover:text-[var(--admin-danger)]"
            >
              ↩ סומן בטעות — ביטול סימון משלוח
            </button>
          </div>
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
              onClick={() => {
                const reason = window.prompt(
                  paidNeedsRefund
                    ? 'סיבת הביטול? ההזמנה שולמה — היא תמתין במצב "ממתינה לזיכוי" ותבוטל סופית רק אחרי זיכוי מלא (תרשים 13).'
                    : 'סיבת הביטול?',
                );
                if (reason === null) return;
                run(() => cancelOrder(order.id, reason.trim() || 'ללא סיבה'));
              }}
              className="admin-btn admin-btn-danger"
            >
              ביטול הזמנה
            </button>
          </div>
        ) : null}

        {awaitingRefund ? (
          <p role="status" className="mb-4 rounded-[var(--radius-sm)] bg-[var(--admin-warning-soft)] px-3 py-2.5 text-caption text-[var(--admin-warning)]">
            אושר ביטול — ההזמנה תעבור אוטומטית למצב ״בוטלה״ כשהזיכוי המלא יצליח.
            זיכוי חלקי אינו מבטל.
          </p>
        ) : null}

        {/* מעברי ציר האספקה: פעולה ראשית תלוית-מצב, ומתחתיה מעברי משנה שקטים */}
        {primaryFulfillment ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => staffTransitionOrder(order.id, 'fulfillment_state', primaryFulfillment.target))}
            className="admin-btn admin-btn-solid mb-3 w-full sm:w-auto"
          >
            {primaryFulfillment.label}
          </button>
        ) : null}
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

        {/* משלוח: חברת שילוח + מספר מעקב ⇒ shipped + מייל. איסוף עצמי
            אינו עובר כאן — ה-CTA הראשי למעלה (מוכן לאיסוף) הוא הצעד שלו */}
        {!order.isPickup && ['preparing', 'unfulfilled'].includes(order.fulfillmentState) ? (
          <div className="mb-4 space-y-2 border-t border-rule pt-3">
            <p className="text-caption font-semibold text-ink">מסירה לשליח</p>
            <input
              type="text"
              aria-label="חברת משלוחים"
              placeholder="חברת משלוחים"
              value={tracking.company}
              onChange={(e) => setTracking((v) => ({ ...v, company: e.target.value }))}
              className="admin-field-input"
            />
            <input
              type="text"
              dir="ltr"
              aria-label="מספר מעקב"
              placeholder="מספר מעקב"
              value={tracking.trackingNumber}
              onChange={(e) => setTracking((v) => ({ ...v, trackingNumber: e.target.value }))}
              className="admin-field-input"
            />
            <input
              type="url"
              dir="ltr"
              aria-label="קישור מעקב"
              placeholder="קישור מעקב (רשות)"
              value={tracking.trackingUrl}
              onChange={(e) => setTracking((v) => ({ ...v, trackingUrl: e.target.value }))}
              className="admin-field-input"
            />
            <button
              type="button"
              disabled={pending || !tracking.company || !tracking.trackingNumber}
              onClick={() =>
                run(
                  () =>
                    addTracking(order.id, {
                      company: tracking.company,
                      trackingNumber: tracking.trackingNumber,
                      trackingUrl: tracking.trackingUrl || undefined,
                    }),
                  undefined,
                  () =>
                    promptAndUndo(
                      'סיבת ביטול סימון המשלוח? שימו לב: מייל "נשלח" שכבר יצא ללקוח לא יבוטל.',
                      (reason) => undoShipment(order.id, reason),
                    ),
                )
              }
              className="admin-btn admin-btn-solid"
            >
              נמסר לשליח + מייל ללקוח
            </button>
          </div>
        ) : null}

        {/* גבייה על הזמנה ממתינה: תשלום באשראי מוטמע + קישור תשלום ללקוח + סימון תשלום חיצוני */}
        {['pending', 'failed'].includes(order.paymentState) &&
        !['cancelled', 'closed'].includes(order.state) ? (
          <div className="mb-4 flex flex-wrap gap-2 border-t border-rule pt-3">
            {isAdmin ? <CardPaymentDrawer orderId={order.id} /> : null}
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(
                  () => sendPaymentLink(order.id),
                  'לשלוח ללקוח מייל עם קישור לתשלום מאובטח במורנינג?',
                )
              }
              className="admin-btn admin-btn-quiet"
            >
              שליחת קישור תשלום במייל
            </button>
            {isAdmin ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(
                    () => markManualPayment(order.id),
                    'לסמן שהתשלום התקבל מחוץ לאתר (מזומן/העברה)? הפעולה מתועדת ב-audit.',
                    () =>
                      promptAndUndo('סיבת ביטול סימון התשלום? (לתיעוד בציר הזמן)', (reason) =>
                        undoManualPayment(order.id, reason),
                      ),
                  )
                }
                className="admin-btn admin-btn-quiet"
              >
                סימון תשלום חיצוני
              </button>
            ) : null}
          </div>
        ) : null}

        {isAdmin && order.refundable > 0 ? (
          <div className="mb-2 border-t border-rule pt-3">
            <RefundDialog
              orderId={order.id}
              refundable={order.refundable}
              items={order.items}
              shippingTotal={order.shippingTotal}
              onDone={() => router.refresh()}
            />
          </div>
        ) : null}

        {/* [1.3] מחיקת הזמנה — רק ללא תשלום/מסמך; בלתי הפיכה, אישור כפול */}
        {isAdmin && !['paid', 'partially_refunded', 'refunded'].includes(order.paymentState) ? (
          <div className="mb-4 border-t border-rule pt-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!window.confirm('למחוק את ההזמנה לצמיתות? הפעולה בלתי הפיכה.')) return;
                if (!window.confirm('אישור אחרון: ההזמנה, פריטיה וההיסטוריה שלה יימחקו סופית.')) return;
                startTransition(async () => {
                  const result = await deleteOrder(order.id);
                  if (result.ok) {
                    router.push('/admin/orders');
                  } else {
                    setMessage({ text: result.error ?? 'המחיקה נכשלה', ok: false });
                  }
                });
              }}
              className="admin-btn admin-btn-danger w-full"
            >
              מחיקת ההזמנה לצמיתות
            </button>
          </div>
        ) : null}

        {/* [1.1] עלות המשלוח בפועל — מזינה את דוח פער המשלוח (17.14) */}
        {isAdmin ? (
          <div className="mb-2 space-y-2 border-t border-rule pt-3">
            <p className="text-caption font-semibold text-ink">עלות משלוח בפועל (לדוח הרווחיות)</p>
            <div className="flex gap-2">
              <input
                type="number"
                dir="ltr"
                min={0}
                step={0.01}
                aria-label="עלות משלוח בפועל"
              placeholder='מה שולם לחברת המשלוחים בש"ח'
                value={actualShipping}
                onChange={(e) => setActualShipping(e.target.value)}
                className="admin-field-input"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    setActualShippingCost(
                      order.id,
                      actualShipping.trim() === '' ? null : Number(actualShipping),
                    ),
                  )
                }
                className="admin-btn admin-btn-quiet shrink-0"
              >
                שמירה
              </button>
            </div>
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
