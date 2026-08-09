import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { listOrders, SAVED_VIEWS, savedViewHref, type OrdersFilter } from '@/lib/admin/commerce-queries';
import { formatPrice } from '@/lib/commerce/pricing';
import {
  DOCUMENT_STATE_LABELS,
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
  // [1.4] כל תצוגה נושאת view משלה עכשיו — השוואה ישירה אחת, לא התאמה
  // חלקית של state+payment ששכחה את ציר האספקה (ראו הערה ב-SAVED_VIEWS).
  const activeView = filter.view
    ? Object.entries(SAVED_VIEWS).find(([, view]) => view.filter.view === filter.view)?.[0]
    : undefined;
  const result = await listOrders(filter);
  const { orders, page, pageSize, total, error } = result;
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filter.q) params.set('q', filter.q);
    if (filter.state) params.set('state', filter.state);
    if (filter.payment) params.set('payment', filter.payment);
    if (filter.fulfillment) params.set('fulfillment', filter.fulfillment);
    if (filter.view) params.set('view', filter.view);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/orders?${qs}` : '/admin/orders';
  };

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
        {Object.entries(SAVED_VIEWS).map(([key, view]) => (
          <ViewChip key={key} href={savedViewHref(key)} label={view.label} active={activeView === key} />
        ))}
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

      {error ? (
        <div role="alert" className="admin-card px-6 py-10 text-center text-small text-[var(--admin-danger)]">
          שגיאה בטעינת ההזמנות מהמסד. זו לא רשימה ריקה — נסו לרענן, ואם זה חוזר פנו לתמיכה הטכנית.
        </div>
      ) : orders.length === 0 ? (
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
                  <td className="px-4 py-3 text-caption text-muted">{DOCUMENT_STATE_LABELS[order.document_state] ?? order.document_state}</td>
                  <td className="px-4 py-3 text-caption text-muted">
                    {order.channel === 'web' ? 'אתר' : order.channel === 'phone' ? 'טלפון' : 'ידני'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && (total == null || total > pageSize || page > 1) ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
          <span className="text-caption text-muted">
            {total != null
              ? `עמוד ${page} מתוך ${totalPages} · ${total.toLocaleString('he-IL')} הזמנות בסינון הנוכחי`
              : `עמוד ${page} · לא ניתן לספור את הסך הכול`}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="admin-btn admin-btn-quiet">
                הקודם
              </Link>
            ) : null}
            {orders.length === pageSize && (totalPages == null || page < totalPages) ? (
              <Link href={pageHref(page + 1)} className="admin-btn admin-btn-quiet">
                הבא
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function ViewChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
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
