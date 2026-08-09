import { AdminIcon, type AdminIconName } from '@/components/admin/AdminIcons';
import type { FulfillmentState, OrderState, PaymentState } from '@/lib/supabase/types';

/**
 * [1.3] פס התהליך בראש עמוד ההזמנה: חמשת שלבי הטיפול במבט אחד —
 * נקלטה → שולמה → לוקטה ונארזה → נשלחה/נאספה → נמסרה. השלב הפעיל
 * מודגש; ביטול מציג פס אדום במקום. זה "עמוד לפי תהליך הטיפול".
 */
export function OrderProcessStrip({
  state,
  paymentState,
  fulfillmentState,
  isPickup,
}: {
  state: OrderState;
  paymentState: PaymentState;
  fulfillmentState: FulfillmentState;
  isPickup: boolean;
}) {
  if (state === 'cancelled' || state === 'cancel_pending_refund') {
    return (
      <div className="admin-card mb-6 flex items-center gap-3 border-[var(--admin-danger)]/30 bg-[var(--admin-danger-soft)] px-5 py-3.5">
        <AdminIcon name="x" className="h-5 w-5 text-[var(--admin-danger)]" />
        <p className="text-small font-semibold text-[var(--admin-danger)]">
          {state === 'cancelled'
            ? 'ההזמנה בוטלה'
            : 'אושר ביטול — ממתינה לזיכוי מלא (תעבור ל"בוטלה" אוטומטית)'}
        </p>
      </div>
    );
  }

  const paid = ['paid', 'partially_refunded', 'refunded'].includes(paymentState);
  const packed = ['ready_for_pickup', 'shipped', 'delivered', 'fulfilled'].includes(fulfillmentState);
  const sent = ['shipped', 'delivered', 'fulfilled'].includes(fulfillmentState);
  const delivered = ['delivered', 'fulfilled'].includes(fulfillmentState) || state === 'completed';

  const steps: { label: string; icon: AdminIconName; done: boolean; hint: string }[] = [
    { label: 'נקלטה', icon: 'orders', done: true, hint: 'ההזמנה נוצרה עם צילום מחירים ומלאי שמור' },
    { label: 'שולמה', icon: 'finance', done: paid, hint: paid ? 'התשלום אושר' : 'ממתינה לתשלום — קישור תשלום או סימון חיצוני' },
    { label: 'לוקטה ונארזה', icon: 'inventory', done: packed, hint: 'סמנו מה לוקט בפאנל הליקוט' },
    { label: isPickup ? 'מוכנה לאיסוף' : 'נשלחה', icon: 'shipping', done: sent || (isPickup && packed), hint: isPickup ? 'הלקוח קיבל מייל שההזמנה מוכנה' : 'מסירה לשליח עם מספר מעקב שולחת מייל' },
    { label: isPickup ? 'נאספה' : 'נמסרה', icon: 'check', done: delivered, hint: 'סגירת ההזמנה' },
  ];
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <ol className="admin-card mb-6 flex items-stretch gap-0 overflow-x-auto px-2 py-3" aria-label="שלבי הטיפול">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        return (
          <li key={step.label} className="flex min-w-0 flex-1 items-center">
            <div
              className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-[10px] px-2 py-2 text-center ${
                isActive ? 'bg-[var(--admin-accent-soft)]' : ''
              }`}
              title={step.hint}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  step.done
                    ? 'bg-[var(--admin-success-soft)] text-[var(--admin-success)]'
                    : isActive
                      ? 'bg-[var(--admin-accent)] text-white'
                      : 'bg-cream-2 text-muted'
                }`}
              >
                {step.done ? <AdminIcon name="check" className="h-4 w-4" /> : <AdminIcon name={step.icon} className="h-4 w-4" />}
              </span>
              <span className={`truncate text-caption ${step.done || isActive ? 'font-semibold text-ink' : 'text-muted'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span aria-hidden="true" className={`mx-1 h-0.5 w-4 shrink-0 rounded sm:w-8 ${step.done ? 'bg-[var(--admin-success)]' : 'bg-cream-2'}`} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
