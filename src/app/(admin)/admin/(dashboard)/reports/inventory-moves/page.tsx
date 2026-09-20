import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { INVENTORY_MOVE_TYPE_LABELS, listInventoryMoves } from '@/lib/admin/commerce-queries';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export const dynamic = 'force-dynamic';

const ACTOR_TYPE_LABELS: Record<string, string> = {
  customer: 'לקוח',
  staff: 'צוות',
  system: 'מערכת',
  morning: 'מורנינג',
  shipping_provider: 'חברת משלוחים',
};

function formatDateTime(value: string): string {
  return formatAdminDate(value, 'dateTime');
}

/**
 * [1.6] היסטוריית תנועות מלאי (ביקורת ג.12/ט.6) — gated ל-'store' (לא
 * 'store_view') כדי להתאים בדיוק ל-RLS של inventory_moves
 * (can_manage_store: admin/manager/seller, בלי picker) — אחרת מלקט
 * היה רואה מסך ריק בלי שגיאה, ולא היה יודע שההרשאה היא הסיבה.
 */
export default async function InventoryMovesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ book?: string; type?: string; page?: string }>;
}) {
  await requireScreenPermission('reports-inventory-moves', 'view');
  const filter = await searchParams;
  const result = await listInventoryMoves({ bookId: filter.book, moveType: filter.type, page: filter.page });
  const { rows, page, pageSize, total, error } = result;
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (filter.book) params.set('book', filter.book);
    if (filter.type) params.set('type', filter.type);
    if (targetPage > 1) params.set('page', String(targetPage));
    const qs = params.toString();
    return qs ? `/admin/reports/inventory-moves?${qs}` : '/admin/reports/inventory-moves';
  };

  return (
    <>
      <AdminHeader
        title="תנועות מלאי"
        description="Ledger מלא של כל שינוי מלאי — קליטה, מכירה, ביטול, החזרה, נזק, ספירה ותיקון ידני. מי ביצע ומתי."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <form method="get" action="/admin/reports/inventory-moves" className="mb-5 flex flex-wrap items-center gap-2">
        {filter.book ? <input type="hidden" name="book" value={filter.book} /> : null}
        <label htmlFor="move-type" className="text-caption text-muted">
          סוג תנועה
        </label>
        <select id="move-type" name="type" defaultValue={filter.type ?? ''} className="admin-field-input max-w-xs">
          <option value="">הכל</option>
          {Object.entries(INVENTORY_MOVE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="admin-btn admin-btn-quiet">
          סינון
        </button>
        {filter.book ? (
          <Link href="/admin/reports/inventory-moves" className="admin-btn admin-btn-ghost">
            נקה סינון ספר
          </Link>
        ) : null}
      </form>

      {error ? (
        <div role="alert" className="admin-card px-6 py-10 text-center text-small text-[var(--admin-danger)]">
          שגיאה בטעינת תנועות המלאי.
        </div>
      ) : rows.length === 0 ? (
        <div className="admin-card px-6 py-10 text-center text-small text-muted">אין תנועות תואמות.</div>
      ) : (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table w-full min-w-[56rem] text-small">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-start">תאריך</th>
                <th scope="col" className="px-4 py-3 text-start">ספר</th>
                <th scope="col" className="px-4 py-3 text-start">מיקום</th>
                <th scope="col" className="px-4 py-3 text-start">סוג</th>
                <th scope="col" className="px-4 py-3 text-start">שינוי</th>
                <th scope="col" className="px-4 py-3 text-start">מבצע</th>
                <th scope="col" className="px-4 py-3 text-start">הערה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-rule/60">
                  <td className="px-4 py-2.5 tabular-nums text-muted">{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/reports/inventory-moves?book=${row.bookId}`} className="text-[var(--admin-accent)] underline">
                      {row.bookTitle}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{row.locationName}</td>
                  <td className="px-4 py-2.5">{INVENTORY_MOVE_TYPE_LABELS[row.moveType] ?? row.moveType}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className={row.quantityDelta > 0 ? 'text-[var(--admin-success)]' : 'text-[var(--admin-danger)]'}>
                      {row.quantityDelta > 0 ? '+' : ''}
                      {row.quantityDelta}
                    </span>
                    <span className="ms-1.5 text-caption text-muted">
                      ({row.onHandBefore} ← {row.onHandAfter})
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {row.actorName ?? ACTOR_TYPE_LABELS[row.actorType] ?? row.actorType}
                    {row.orderId ? (
                      <Link href={`/admin/orders/${row.orderId}`} className="ms-1.5 text-caption text-[var(--admin-accent)] underline">
                        להזמנה
                      </Link>
                    ) : null}
                  </td>
                  <td className="max-w-2xs truncate px-4 py-2.5 text-caption text-muted" title={row.reason ?? row.note ?? undefined}>
                    {row.reason ?? row.note ?? '—'}
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
              ? `עמוד ${page} מתוך ${totalPages} · ${total.toLocaleString('he-IL')} תנועות`
              : `עמוד ${page} · לא ניתן לספור את הסך הכול`}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="admin-btn admin-btn-quiet">
                הקודם
              </Link>
            ) : null}
            {rows.length === pageSize && (totalPages == null || page < totalPages) ? (
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
