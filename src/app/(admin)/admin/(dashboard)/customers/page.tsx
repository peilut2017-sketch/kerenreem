import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

/**
 * ניהול לקוחות (פרק 18): תמונה אחת לכל מי שהזמין — רשומים ואורחים כאחד.
 * המפתח הוא הטלפון (זהות הקשר של הקהל); רשומת customers מצטרפת כשקיימת.
 * שורה נפתחת לרשימת ההזמנות המסוננת — עמוד הלקוח המלא יגיע עם המיזוג.
 */

interface CustomerRow {
  key: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  registered: boolean;
  orders: number;
  paidTotal: number;
  lastOrderAt: string;
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePermission('store');
  const { q } = await searchParams;
  const supabase = await createClient();

  const [ordersRes, customersRes] = supabase
    ? await Promise.all([
        supabase
          .from('orders')
          .select('contact_name, contact_phone, contact_email, user_id, total, payment_state, state, created_at')
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.from('customers').select('id, phone, email, full_name'),
      ])
    : [{ data: [] }, { data: [] }];

  const registeredByPhone = new Map(
    (customersRes.data ?? []).map((c) => [c.phone, c] as const),
  );

  const byKey = new Map<string, CustomerRow>();
  for (const order of ordersRes.data ?? []) {
    if (order.state === 'cancelled' && !order.contact_phone) continue;
    const key = order.contact_phone ?? order.contact_email ?? 'ללא-קשר';
    const row = byKey.get(key) ?? {
      key,
      name: order.contact_name,
      phone: order.contact_phone,
      email: order.contact_email,
      registered: Boolean(order.user_id) || registeredByPhone.has(order.contact_phone ?? ''),
      orders: 0,
      paidTotal: 0,
      lastOrderAt: order.created_at,
    };
    row.orders += 1;
    if (['paid', 'partially_refunded', 'refunded'].includes(order.payment_state)) {
      row.paidTotal += Number(order.total);
    }
    row.name ||= order.contact_name;
    row.email ||= order.contact_email;
    byKey.set(key, row);
  }

  const query = q?.trim() ?? '';
  const rows = [...byKey.values()]
    .filter(
      (row) =>
        !query ||
        (row.name ?? '').includes(query) ||
        (row.phone ?? '').includes(query) ||
        (row.email ?? '').includes(query),
    )
    .sort((a, b) => b.lastOrderAt.localeCompare(a.lastOrderAt))
    .slice(0, 200);

  return (
    <>
      <AdminHeader
        title="לקוחות"
        description="כל מי שהזמין — אורחים ורשומים. הסכום המצטבר סופר הזמנות ששולמו בלבד. פתיחת שורה מציגה את הזמנות הלקוח."
      />

      <form action="/admin/customers" className="mb-4">
        <div className="relative max-w-sm">
          <AdminIcon
            name="search"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="חיפוש בשם, בטלפון או במייל"
            className="admin-field-input ps-9"
          />
        </div>
      </form>

      <AdminTable
        columns={['לקוח', 'קשר', 'הזמנות', 'סה״כ שולם', 'אחרונה', '']}
        empty={rows.length === 0 ? (query ? 'אין תוצאות לחיפוש.' : 'עדיין אין לקוחות.') : undefined}
      >
        {rows.map((row) => (
          <AdminRow key={row.key}>
            <AdminCell>
              <span className="font-medium text-ink">{row.name || '—'}</span>
              {row.registered ? (
                <span className="ms-2 admin-badge admin-badge-accent">רשום</span>
              ) : (
                <span className="ms-2 admin-badge admin-badge-neutral">אורח</span>
              )}
            </AdminCell>
            <AdminCell>
              <span dir="ltr" className="block text-small text-ink-soft">{row.phone ?? '—'}</span>
              {row.email ? (
                <span dir="ltr" className="block text-caption text-muted">{row.email}</span>
              ) : null}
            </AdminCell>
            <AdminCell className="tabular-nums">{row.orders}</AdminCell>
            <AdminCell className="tabular-nums">
              {formatPrice(row.paidTotal, 'he', { alwaysAgorot: true })}
            </AdminCell>
            <AdminCell className="text-small text-muted">
              {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(
                new Date(row.lastOrderAt),
              )}
            </AdminCell>
            <AdminCell className="text-end">
              {row.key !== 'ללא-קשר' ? (
                <Link href={`/admin/customers/${encodeURIComponent(row.key)}`} className="admin-btn admin-btn-ghost">
                  לכרטיס הלקוח
                </Link>
              ) : (
                <Link
                  href={`/admin/orders?q=${encodeURIComponent(row.phone ?? row.email ?? '')}`}
                  className="admin-btn admin-btn-ghost"
                >
                  להזמנות
                </Link>
              )}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
