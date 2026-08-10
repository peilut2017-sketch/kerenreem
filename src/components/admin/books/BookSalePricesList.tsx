'use client';

import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';
import { formatPrice } from '@/lib/commerce/pricing';
import type { BookRow } from '@/lib/admin/queries';

export type SaleStatus = 'active' | 'scheduled' | 'expired' | 'invalid';

export interface SaleRow {
  book: BookRow;
  status: SaleStatus;
}

const STATUS_LABELS: Record<SaleStatus, string> = {
  active: 'פעיל',
  scheduled: 'מתוזמן',
  expired: 'פג תוקף',
  invalid: 'לא תקף',
};

const STATUS_BADGE: Record<SaleStatus, string> = {
  active: 'admin-badge-success',
  scheduled: 'admin-badge-accent',
  expired: 'admin-badge-neutral',
  invalid: 'admin-badge-danger',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(
    new Date(value),
  );
}

function StatusBadge({ status }: { status: SaleStatus }) {
  return <span className={`admin-badge ${STATUS_BADGE[status]}`}>{STATUS_LABELS[status]}</span>;
}

/**
 * [1.8] עטיפת לקוח דקה סביב AdminRecordList — ראו BookEngagementList
 * להסבר המלא: columns/getRowKey/href הם פונקציות, ועמוד השרת (books/
 * sale-prices/page.tsx) לא יכול להעביר אותן ישירות ל-AdminRecordList
 * (מרכיב לקוח) בלי לשבור את גבול השרת/לקוח.
 */
export function BookSalePricesList({ rows }: { rows: SaleRow[] }) {
  const columns: AdminRecordColumn<SaleRow>[] = [
    { key: 'title', header: 'ספר', render: (row) => row.book.title_he, cardHidden: true },
    { key: 'status', header: 'סטטוס', render: (row) => <StatusBadge status={row.status} />, cardHidden: true },
    {
      key: 'price',
      header: 'מחיר רגיל',
      render: (row) => (row.book.price != null ? formatPrice(row.book.price, 'he') : '—'),
    },
    {
      key: 'sale_price',
      header: 'מחיר מבצע',
      render: (row) => (row.book.sale_price != null ? formatPrice(row.book.sale_price, 'he') : '—'),
    },
    { key: 'sale_name', header: 'שם המבצע', render: (row) => row.book.sale_name_he ?? '—' },
    {
      key: 'window',
      header: 'חלון תאריכים',
      render: (row) =>
        row.book.sale_starts_at || row.book.sale_ends_at
          ? `${row.book.sale_starts_at ? formatDate(row.book.sale_starts_at) : '—'} – ${
              row.book.sale_ends_at ? formatDate(row.book.sale_ends_at) : '—'
            }`
          : 'ללא הגבלת זמן',
    },
  ];

  return (
    <AdminRecordList
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.book.id}
      href={(row) => `/admin/books/${row.book.id}`}
      renderCardTitle={(row) => row.book.title_he}
      renderCardBadge={(row) => <StatusBadge status={row.status} />}
      minWidthClassName="min-w-[46rem]"
      emptyMessage="אין ספרים עם מחיר מבצע."
    />
  );
}
