import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { listOrders, SAVED_VIEWS, type OrdersFilter } from '@/lib/admin/commerce-queries';
import { formatPrice } from '@/lib/commerce/pricing';
import {
  ORDER_STATE_LABELS,
  PAYMENT_STATE_LABELS,
  FULFILLMENT_STATE_LABELS,
  stateBadgeClass,
} from '@/components/admin/orders/labels';

export const dynamic = 'force-dynamic';

/**
 * מסך ההזמנות (פרק 9): רשימה עם חיפוש, סינון לפי הצירים ותצוגות
 * שמורות. הסינון ב-URL — תצוגה ניתנת לשיתוף בין אנשי צוות.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersFilter>;
}) {
  await requirePermission('store_view');
  const filter = await searchParams;
  const activeView = Object.entries(SAVED_VIEWS).find(([key, view]) => {
    const merged = { ...view.filter };
    return (
      (filter.view === key || filter.view === merged.view) &&
      (merged.state ?? '') === (filter.state ?? '') &&
      (merged.payment ?? '') === (filter.payment ?? '')
    );
  })?.[0];
  const orders = await listOrders(filter);

  return (
    <>
      <AdminHeader
        title="הזמנות"
        description="כל ההזמנות מהאתר ומהטלפון. ארבעה צירי מצב לכל הזמנה: חיים, תשלום, אספקה ומסמך."
        action={{ href: '/admin/orders/new', label: 'הזמנה טלפונית', icon: 'plus' }}
      />

      {/* תצוגות שמורות */}
      <div className="mb-4 flex flex-wrap gap-2">
        <ViewChip href="/admin/orders" label="הכל" active={!filter.view && !filter.state && !filter.payment && !filter.fulfillment} />
        {Object.entries(SAVED_VIEWS).map(([key, view]) => {
          const params = new URLSearchParams();
          for (const [k, v] of Object.entries(view.filter)) if (v) params.set(k, v);
          if (view.filter.view === undefined && key !== filter.view) params.set('view', key);
          return (
            <ViewChip
              key={key}
              href={`/admin/orders?${params.toString()}`}
              label={view.label}
              active={activeView === key}
            />
          );
        })}
      </div>

      {/* חיפוש */}
      <form method="get" action="/admin/orders" className="mb-5 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={filter.q ?? ''}
          placeholder="חיפוש: מספר הזמנה, שם, טלפון או דוא״ל"
          className="admin-field-input max-w-sm"
        />
        <button type="submit" className="admin-btn admin-btn-quiet">
          חיפוש
        </button>
      </form>

      {orders.length === 0 ? (
        <div className="admin-card px-6 py-10 text-center text-small text-muted">
          אין הזמנות התואמות לסינון.
        </div>
      ) : (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table w-full min-w-[56rem] text-small">
            <thead>
              <tr className="border-b border-rule text-start text-caption text-muted">
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">לקוח</th>
                <th className="px-4 py-3 text-start">תאריך</th>
                <th className="px-4 py-3 text-start">סכום</th>
                <th className="px-4 py-3 text-start">הזמנה</th>
                <th className="px-4 py-3 text-start">תשלום</th>
                <th className="px-4 py-3 text-start">אספקה</th>
                <th className="px-4 py-3 text-start">מסמך</th>
                <th className="px-4 py-3 text-start">ערוץ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-rule/60 transition-colors hover:bg-cream-2/50">
                  <td className="px-4 py-3 font-semibold tabular-nums">
                    <Link href={`/admin/orders/${order.id}`} className="text-[var(--admin-accent)] hover:underline">
                      {order.order_number}
                    </Link>
                    {order.is_gift ? <span className="ms-1.5" title="הזמנת מתנה">🎁</span> : null}
                    {order.tags?.includes('amount-mismatch') ? (
                      <span className="ms-1.5" title="פער סכומים — דורש טיפול">⚠️</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div>{order.contact_name ?? '—'}</div>
                    <div dir="ltr" className="text-caption text-muted">{order.contact_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(new Date(order.created_at))}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPrice(order.total, 'he', { alwaysAgorot: true })}</td>
                  <td className="px-4 py-3"><Badge value={order.state} labels={ORDER_STATE_LABELS} /></td>
                  <td className="px-4 py-3"><Badge value={order.payment_state} labels={PAYMENT_STATE_LABELS} /></td>
                  <td className="px-4 py-3"><Badge value={order.fulfillment_state} labels={FULFILLMENT_STATE_LABELS} /></td>
                  <td className="px-4 py-3 text-caption text-muted">{order.document_state}</td>
                  <td className="px-4 py-3 text-caption text-muted">
                    {order.channel === 'web' ? 'אתר' : order.channel === 'phone' ? 'טלפון' : 'ידני'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ViewChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-caption transition-colors ${
        active
          ? 'bg-[var(--admin-accent)] text-white'
          : 'bg-cream-2 text-ink-soft hover:bg-cream-3'
      }`}
    >
      {label}
    </Link>
  );
}

function Badge({ value, labels }: { value: string; labels: Record<string, string> }) {
  return (
    <span className={`admin-badge ${stateBadgeClass(value)}`}>{labels[value] ?? value}</span>
  );
}
