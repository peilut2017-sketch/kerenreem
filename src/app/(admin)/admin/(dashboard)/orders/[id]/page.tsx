import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { AdminHeader } from '@/components/admin/AdminList';
import { getOrderDetail } from '@/lib/admin/commerce-queries';
import { formatPrice } from '@/lib/commerce/pricing';
import { OrderActionsPanel } from '@/components/admin/orders/OrderActionsPanel';
import { OrderProcessStrip } from '@/components/admin/orders/OrderProcessStrip';
import { PickingPanel } from '@/components/admin/orders/PickingPanel';
import {
  AXIS_LABELS,
  DOC_STATUS_LABELS,
  DOC_TYPE_LABELS,
  DOCUMENT_STATE_LABELS,
  EMAIL_TEMPLATE_LABELS,
  FULFILLMENT_STATE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  NOTIFICATION_STATUS_LABELS,
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  PAYMENT_STATUS_LABELS,
  axisValueLabel,
  stateBadgeClass,
} from '@/components/admin/orders/labels';

export const dynamic = 'force-dynamic';

const EVENT_LABELS: Record<string, string> = {
  order_created: 'ההזמנה נוצרה',
  payment_started: 'נפתח דף תשלום',
  payment_succeeded: 'התשלום אושר',
  payment_failed: 'התשלום נכשל',
  webhook_received: 'התקבלה התראה ממורנינג',
  webhook_amount_mismatch: '⚠️ פער סכומים מול מורנינג',
  document_created: 'הופק מסמך חשבונאי',
  document_failed: 'הפקת המסמך נכשלה',
  status_changed: 'שינוי סטטוס',
  stock_reserved: 'מלאי נשמר',
  stock_released: 'שמירת מלאי שוחררה',
  tracking_added: 'נוסף מספר מעקב',
  note_added: 'הערה פנימית',
  email_sent: 'נשלח מייל',
  cancel_requested: 'הלקוח ביקש ביטול',
  cancelled: 'ההזמנה בוטלה',
  refund_issued: 'בוצע זיכוי',
  cancel_approved: 'אושר ביטול — ממתין לזיכוי',
  cancel_still_pending: 'זיכוי חלקי — הביטול עדיין ממתין',
  actual_shipping_cost_set: 'עודכנה עלות משלוח בפועל',
  payment_link_sent: 'נשלח קישור תשלום',
  order_edited: 'ההזמנה נערכה',
  staff_discount_set: 'הוגדרה הנחת צוות',
  picking_updated: 'עודכן ליקוט',
  reconciliation_mismatch: '⚠️ פער מול מורנינג בהתאמה היומית',
};

const ACTOR_LABELS: Record<string, string> = {
  customer: 'לקוח',
  staff: 'צוות',
  system: 'מערכת',
  morning: 'מורנינג',
  shipping_provider: 'ספק שילוח',
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

/**
 * עמוד הזמנה בניהול (פרק 9.4): תקציר בארבעה צירים, פריטים בצילום,
 * לקוח, תשלום, מסמכים, הודעות — וציר זמן מלא עם מבצע כל פעולה.
 */
export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePermission('store_view');
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const { order, items, events, payments, documents, notifications } = detail;
  const isAdmin = hasPermission(session.profile.role, 'finance');
  // [1.4/1.4] המלקט (store_view) חייב לראות את פאנל הליקוט; רק 'store'
  // ומעלה עורכים את ההזמנה עצמה — ורק הם רואים PII וסכומים (ראו הערה
  // בפאנל הליקוט: תפקיד שנוצר כדי ללקט אינו צריך לראות שם/טלפון/מחיר).
  const canPick = hasPermission(session.profile.role, 'store_view');
  const canEdit = hasPermission(session.profile.role, 'store');
  const canSeeMoney = canEdit;
  const succeededCharge = payments.find((p) => p.kind === 'charge' && p.status === 'succeeded');
  const refundedTotal = payments
    .filter((p) => p.kind === 'refund' && p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <AdminHeader
        title={
          canSeeMoney && order.contact_name
            ? `הזמנה ${order.order_number} · ${order.contact_name}`
            : `הזמנה ${order.order_number}`
        }
        description={`נוצרה ${formatDateTime(order.created_at)} · ${
          order.channel === 'web' ? 'מהאתר' : order.channel === 'phone' ? 'בטלפון' : 'ידנית'
        }${order.is_gift ? ' · 🎁 מתנה' : ''}${
          canSeeMoney ? ` · ${formatPrice(order.total, 'he', { alwaysAgorot: true })}` : ''
        }`}
        action={{ href: '/admin/orders', label: 'כל ההזמנות', variant: 'quiet' }}
      />

      <OrderProcessStrip
        state={order.state}
        paymentState={order.payment_state}
        fulfillmentState={order.fulfillment_state}
        isPickup={order.fulfillment_type === 'pickup'}
      />

      {/* תקציר ארבעת הצירים */}
      <div className="mb-6 flex flex-wrap gap-2.5">
        <span className={`admin-badge ${stateBadgeClass(order.state)}`}>
          הזמנה: {ORDER_STATE_LABELS[order.state]}
        </span>
        <span className={`admin-badge ${stateBadgeClass(order.payment_state)}`}>
          תשלום: {PAYMENT_STATE_LABELS[order.payment_state]}
        </span>
        <span className={`admin-badge ${stateBadgeClass(order.fulfillment_state)}`}>
          אספקה: {FULFILLMENT_STATE_LABELS[order.fulfillment_state]}
        </span>
        <span className={`admin-badge ${stateBadgeClass(order.document_state)}`}>
          מסמך: {DOCUMENT_STATE_LABELS[order.document_state]}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          {/* פריטים — הצילום, לא הקטלוג */}
          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">פריטי ההזמנה</h2>
            <ul className="divide-y divide-rule/60">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-2.5 text-small">
                  <span>
                    {item.title_snapshot}
                    {item.is_preorder ? ' · הזמנה מוקדמת' : ''}
                    <span className="text-muted"> ×{item.quantity}</span>
                    {item.sku_snapshot ? (
                      <span dir="ltr" className="ms-2 text-caption text-muted">{item.sku_snapshot}</span>
                    ) : null}
                  </span>
                  {canSeeMoney ? (
                    <span className="tabular-nums">
                      {formatPrice(item.line_total ?? item.unit_price * item.quantity, 'he', { alwaysAgorot: true })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {canSeeMoney ? (
              <dl className="mt-3 space-y-1.5 border-t border-rule pt-3 text-small">
                <Row label="סכום ביניים" value={formatPrice(order.subtotal, 'he', { alwaysAgorot: true })} />
                {order.discount_total > 0 ? (
                  <Row label="הנחה" value={`− ${formatPrice(order.discount_total, 'he', { alwaysAgorot: true })}`} />
                ) : null}
                <Row label="משלוח" value={formatPrice(order.shipping_total, 'he', { alwaysAgorot: true })} />
                {order.donation_amount > 0 ? (
                  <Row label="תרומה" value={formatPrice(order.donation_amount, 'he', { alwaysAgorot: true })} />
                ) : null}
                <Row bold label="סה״כ" value={formatPrice(order.total, 'he', { alwaysAgorot: true })} />
                {refundedTotal > 0 ? (
                  <Row label="זוכה" value={`− ${formatPrice(refundedTotal, 'he', { alwaysAgorot: true })}`} />
                ) : null}
              </dl>
            ) : null}
          </section>

          {/* לקוח ואספקה — פרטי הקשר (שם/טלפון/דוא״ל) הם PII ומוסתרים
              מהמלקט (store_view בלבד); הכתובת נשארת גלויה כי היא נחוצה
              לאריזה/ניתוב המשלוח בפועל. */}
          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">לקוח ואספקה</h2>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-small sm:grid-cols-2">
              {canSeeMoney ? (
                <>
                  <Row label="שם" value={order.contact_name ?? '—'} />
                  <Row label="טלפון" value={order.contact_phone ?? '—'} ltr />
                  <Row label="דוא״ל" value={order.contact_email ?? '—'} ltr />
                </>
              ) : null}
              <Row
                label="אספקה"
                value={
                  order.fulfillment_type === 'pickup'
                    ? 'איסוף עצמי'
                    : order.shipping_method_name_snapshot ?? 'משלוח'
                }
              />
              {order.promised_delivery_date ? (
                <Row label="תאריך מובטח" value={order.promised_delivery_date} ltr />
              ) : null}
            </dl>
            {order.shipping_address ? (
              <p className="mt-3 rounded-[var(--radius-sm)] bg-cream-2/70 px-3 py-2 text-small text-ink-soft">
                {canSeeMoney && order.is_gift && order.gift_recipient_name
                  ? `נמען המתנה: ${order.gift_recipient_name} · `
                  : ''}
                {[
                  order.shipping_address.recipient_name,
                  `${order.shipping_address.street} ${order.shipping_address.house_number}`,
                  order.shipping_address.entrance ? `כניסה ${order.shipping_address.entrance}` : null,
                  order.shipping_address.floor ? `קומה ${order.shipping_address.floor}` : null,
                  order.shipping_address.apartment ? `דירה ${order.shipping_address.apartment}` : null,
                  order.shipping_address.city,
                  order.shipping_address.zip,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            ) : null}
            {canSeeMoney && order.is_gift && order.gift_message ? (
              <p className="mt-2 text-caption text-muted">הקדשה: “{order.gift_message}”</p>
            ) : null}
            {order.courier_notes ? (
              <p className="mt-2 text-caption text-muted">הערות לשליח: {order.courier_notes}</p>
            ) : null}
          </section>

          {/* תשלומים ומסמכים — כספי, למי שיכול לראות סכומים בלבד */}
          {canSeeMoney ? (
          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">תשלומים ומסמכים</h2>
            {payments.length === 0 ? (
              <p className="text-small text-muted">אין ניסיונות תשלום.</p>
            ) : (
              <ul className="space-y-1.5 text-small">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-2">
                    <span className={`admin-badge ${stateBadgeClass(payment.status)}`}>
                      {payment.kind === 'refund' ? 'זיכוי' : 'חיוב'} · {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
                    </span>
                    <span className="tabular-nums">{formatPrice(payment.amount, 'he', { alwaysAgorot: true })}</span>
                    <span className="text-caption text-muted">
                      {payment.method ?? payment.provider}
                      {payment.morning_transaction_id ? (
                        <span dir="ltr"> · {payment.morning_transaction_id}</span>
                      ) : null}
                      {' · '}
                      {formatDateTime(payment.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {documents.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-rule pt-3 text-small">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center gap-2">
                    <span className={`admin-badge ${stateBadgeClass(doc.status)}`}>
                      {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type} · {DOC_STATUS_LABELS[doc.status] ?? doc.status}
                    </span>
                    {doc.doc_number ? <span dir="ltr">{doc.doc_number}</span> : null}
                    {doc.download_url ? (
                      <a href={doc.download_url} target="_blank" rel="noopener noreferrer" className="text-[var(--admin-accent)] underline">
                        פתיחה
                      </a>
                    ) : null}
                    {doc.error ? <span className="text-caption text-muted">{doc.error}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          ) : null}

          {/* הודעות שנשלחו */}
          {canSeeMoney ? (
          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">הודעות ללקוח</h2>
            {notifications.length === 0 ? (
              <p className="text-small text-muted">טרם נשלחו הודעות.</p>
            ) : (
              <ul className="space-y-1.5 text-small">
                {notifications.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2">
                    <span className={`admin-badge ${stateBadgeClass(entry.status)}`}>
                      {NOTIFICATION_CHANNEL_LABELS[entry.channel] ?? entry.channel} · {NOTIFICATION_STATUS_LABELS[entry.status] ?? entry.status}
                    </span>
                    <span>{EMAIL_TEMPLATE_LABELS[entry.template] ?? entry.template}</span>
                    <span className="text-caption text-muted">{formatDateTime(entry.created_at)}</span>
                    {entry.error ? <span className="text-caption text-muted">{entry.error}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          ) : null}

          {/* ציר זמן */}
          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">ציר זמן</h2>
            <ol className="space-y-2.5 text-small">
              {events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline gap-2">
                  <span className="text-caption text-muted tabular-nums">{formatDateTime(event.created_at)}</span>
                  <span className="font-semibold">{EVENT_LABELS[event.event_type] ?? event.event_type}</span>
                  <span className="text-caption text-muted">
                    {ACTOR_LABELS[event.actor_type] ?? event.actor_type}
                    {event.actor_label ? ` · ${event.actor_label}` : ''}
                  </span>
                  {event.event_type === 'note_added' && typeof event.data.note === 'string' ? (
                    <span className="w-full text-ink-soft">“{event.data.note}”</span>
                  ) : null}
                  {event.event_type === 'status_changed' ? (
                    <span className="text-caption text-muted">
                      {AXIS_LABELS[String(event.data.axis)] ?? String(event.data.axis)}:{' '}
                      {axisValueLabel(String(event.data.axis), String(event.data.from))} →{' '}
                      {axisValueLabel(String(event.data.axis), String(event.data.to))}
                    </span>
                  ) : null}
                  {event.event_type === 'tracking_added' && typeof event.data.tracking_number === 'string' ? (
                    <span className="w-full text-caption text-ink-soft">
                      {String(event.data.company ?? '')} · <span dir="ltr">{String(event.data.tracking_number)}</span>
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>

        {canPick ? (
          <div className="space-y-5">
          <PickingPanel
            orderId={order.id}
            items={items.map((item) => ({
              id: item.id,
              title: item.title_snapshot ?? '',
              quantity: item.quantity,
              picked: item.picked_quantity,
            }))}
            packingNote={order.packing_note}
            canEdit={canEdit}
            canDiscount={isAdmin}
            editable={
              ['pending', 'failed'].includes(order.payment_state) &&
              ['unfulfilled', 'preparing'].includes(order.fulfillment_state)
            }
            staffDiscount={Number(order.staff_discount ?? 0)}
          />
          {canEdit ? (
            <OrderActionsPanel
              order={{
                id: order.id,
                state: order.state,
                paymentState: order.payment_state,
                fulfillmentState: order.fulfillment_state,
                documentState: order.document_state,
                total: order.total,
                refundable: succeededCharge ? Number(succeededCharge.amount) - refundedTotal : 0,
                actualShippingCost: order.actual_shipping_cost,
              }}
              isAdmin={isAdmin}
            />
          ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  ltr,
}: {
  label: string;
  value: string;
  bold?: boolean;
  ltr?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={bold ? 'font-bold text-ink' : 'text-muted'}>{label}</dt>
      <dd dir={ltr ? 'ltr' : undefined} className={`tabular-nums ${bold ? 'font-bold text-ink' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
