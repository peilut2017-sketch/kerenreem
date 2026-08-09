import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getCustomerDetail } from '@/lib/admin/commerce-queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { formatPrice } from '@/lib/commerce/pricing';
import {
  FULFILLMENT_STATE_LABELS,
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  stateBadgeClass,
} from '@/components/admin/orders/labels';

export const dynamic = 'force-dynamic';

const CONSENT_KIND_LABELS: Record<string, string> = {
  marketing_email: 'דיוור במייל',
  channel_sms: 'SMS',
  channel_whatsapp: 'וואטסאפ',
  terms: 'תנאי שימוש',
};

const CONSENT_SOURCE_LABELS: Record<string, string> = {
  checkout: 'בקופה',
  account: 'בהגדרות חשבון',
  thank_you: 'בעמוד תודה',
  unsubscribe_link: 'קישור הסרה',
  staff: 'ע״י הצוות',
};

const OPT_IN_KINDS = ['marketing_email', 'channel_sms', 'channel_whatsapp'] as const;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

/**
 * [1.6] עמוד לקוח (ביקורת ג.25/ט.3) — הפער החמור ביותר בסעיף: הסכמות
 * (marketing_email/channel_sms/channel_whatsapp/terms) לא היו נצפות
 * בשום מקום בממשק הניהול, פער רגולטורי של ממש. מפתח הזהות הוא טלפון/
 * מייל, לא customers.id — כמו ברשימת הלקוחות, כי רוב הלקוחות אורחים.
 */
export default async function CustomerDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireScreenPermission('customers', 'view');
  const { key } = await params;
  const detail = await getCustomerDetail(key);

  if (detail.error) {
    return <AdminHeader title="לקוח" description="אין חיבור למסד." />;
  }
  if (detail.orders.length === 0 && !detail.customer) notFound();

  const optInState = (kind: (typeof OPT_IN_KINDS)[number]): { granted: boolean; source: string } | null => {
    if (detail.customer) {
      const granted =
        kind === 'marketing_email'
          ? detail.customer.marketing_email_opt_in
          : kind === 'channel_sms'
            ? detail.customer.channel_sms_opt_in
            : detail.customer.channel_whatsapp_opt_in;
      return { granted, source: 'customers' };
    }
    const latest = detail.consents.find((c) => c.kind === kind);
    return latest ? { granted: latest.granted, source: CONSENT_SOURCE_LABELS[latest.source] ?? latest.source } : null;
  };

  return (
    <>
      <AdminHeader
        title={detail.contactName || 'לקוח ללא שם'}
        description={[detail.contactPhone, detail.contactEmail].filter(Boolean).join(' · ') || undefined}
        action={{ href: '/admin/customers', label: 'כל הלקוחות', variant: 'quiet' }}
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <span className={`admin-badge ${detail.customer ? 'admin-badge-accent' : 'admin-badge-neutral'}`}>
          {detail.customer ? 'רשום' : 'אורח'}
        </span>
        <span className="admin-badge admin-badge-neutral">
          {detail.orders.length.toLocaleString('he-IL')} הזמנות
        </span>
      </div>

      <section aria-labelledby="customer-consents" className="admin-card mb-6 px-5 py-4">
        <h2 id="customer-consents" className="mb-1 text-small font-bold text-ink">
          הסכמות
        </h2>
        <p className="mb-4 text-caption text-muted">
          {detail.customer
            ? 'מצב נוכחי מתוך רשומת הלקוח, ומטה — היסטוריית האירועים המלאה.'
            : 'ללקוח אורח אין מתג מצב שמור — המצב הנוכחי הוא האירוע האחרון בהיסטוריה.'}
        </p>

        <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {OPT_IN_KINDS.map((kind) => {
            const state = optInState(kind);
            return (
              <div key={kind} className="rounded-[var(--admin-radius-btn)] border border-rule px-3 py-2.5">
                <dt className="text-caption text-muted">{CONSENT_KIND_LABELS[kind]}</dt>
                <dd className="mt-1">
                  {state ? (
                    <span className={`admin-badge ${state.granted ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                      {state.granted ? 'מאושר' : 'לא מאושר'}
                    </span>
                  ) : (
                    <span className="text-caption text-muted">אין נתון</span>
                  )}
                </dd>
              </div>
            );
          })}
        </dl>

        {detail.consents.length === 0 ? (
          <p className="text-small text-muted">אין אירועי הסכמה רשומים.</p>
        ) : (
          <div className="admin-table-wrap overflow-x-auto">
            <table className="admin-table min-w-[36rem]">
              <thead>
                <tr>
                  <th scope="col">תאריך</th>
                  <th scope="col">סוג</th>
                  <th scope="col">מצב</th>
                  <th scope="col">מקור</th>
                  <th scope="col">הזמנה</th>
                </tr>
              </thead>
              <tbody>
                {detail.consents.map((event) => (
                  <tr key={event.id}>
                    <td className="tabular-nums">{formatDateTime(event.created_at)}</td>
                    <td>{CONSENT_KIND_LABELS[event.kind] ?? event.kind}</td>
                    <td>
                      <span className={`admin-badge ${event.granted ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                        {event.granted ? 'אושר' : 'הוסר'}
                      </span>
                    </td>
                    <td className="text-muted">{CONSENT_SOURCE_LABELS[event.source] ?? event.source}</td>
                    <td>
                      {event.order_id ? (
                        <Link href={`/admin/orders/${event.order_id}`} className="text-[var(--admin-accent)] underline">
                          פתיחה
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail.addresses.length > 0 ? (
        <section aria-labelledby="customer-addresses" className="admin-card mb-6 px-5 py-4">
          <h2 id="customer-addresses" className="mb-3 text-small font-bold text-ink">
            כתובות שמורות
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {detail.addresses.map((address) => (
              <li key={address.id} className="rounded-[var(--admin-radius-btn)] border border-rule px-3 py-2.5 text-small text-ink-soft">
                <p className="font-semibold text-ink">
                  {address.label || address.recipient_name}
                  {address.is_default ? <span className="ms-2 admin-badge admin-badge-accent">ברירת מחדל</span> : null}
                </p>
                <p className="mt-1">
                  {[
                    address.recipient_name,
                    `${address.street} ${address.house_number}`,
                    address.apartment ? `דירה ${address.apartment}` : null,
                    address.city,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
                {address.phone ? (
                  <p dir="ltr" className="mt-1 text-caption text-muted">
                    {address.phone}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="customer-orders" className="admin-card px-5 py-4">
        <h2 id="customer-orders" className="mb-3 text-small font-bold text-ink">
          הזמנות
        </h2>
        {detail.orders.length === 0 ? (
          <p className="text-small text-muted">אין הזמנות.</p>
        ) : (
          <div className="admin-table-wrap overflow-x-auto">
            <table className="admin-table min-w-[40rem]">
              <thead>
                <tr>
                  <th scope="col">הזמנה</th>
                  <th scope="col">תאריך</th>
                  <th scope="col">סכום</th>
                  <th scope="col">מצב</th>
                  <th scope="col">תשלום</th>
                  <th scope="col">אספקה</th>
                </tr>
              </thead>
              <tbody>
                {detail.orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[var(--admin-accent)] underline">
                        #{order.orderNumber}
                      </Link>
                    </td>
                    <td className="tabular-nums text-muted">{formatDateTime(order.createdAt)}</td>
                    <td className="tabular-nums">{formatPrice(order.total - order.donationAmount, 'he', { alwaysAgorot: true })}</td>
                    <td>
                      <span className={`admin-badge ${stateBadgeClass(order.state)}`}>
                        {ORDER_STATE_LABELS[order.state] ?? order.state}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${stateBadgeClass(order.paymentState)}`}>
                        {PAYMENT_STATE_LABELS[order.paymentState] ?? order.paymentState}
                      </span>
                    </td>
                    <td className="text-muted">{FULFILLMENT_STATE_LABELS[order.fulfillmentState] ?? order.fulfillmentState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
