'use client';

import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';
import { formatPrice } from '@/lib/commerce/pricing';
import type { BookEngagementRow } from '@/lib/admin/reporting/book-engagement-data';

/**
 * [1.8] עטיפת לקוח דקה סביב AdminRecordList: ה-columns/getRowKey/href
 * של AdminRecordList הם פונקציות, וכשעמוד השרת (reports/books/page.tsx,
 * בלי 'use client') בנה אותן ישירות ב-JSX, Next זרק "Functions cannot be
 * passed directly to Client Components" — פונקציה אינה ניתנת לסריאליזציה
 * דרך גבול שרת/לקוח. כאן ה-rows (נתונים בלבד, סריאליזביליים) מגיעים
 * מהשרת, וכל בניית הפונקציות קורית בתוך גבול הלקוח עצמו.
 */
export function BookEngagementList({ rows }: { rows: BookEngagementRow[] }) {
  const n = (value: number) => value.toLocaleString('he-IL');
  /** "פעולות (מכשירים)" — סך הלחיצות, ובסוגריים כמה מכשירים שונים */
  const withDevices = (total: number, devices: number) => (total === 0 ? '0' : `${n(total)} (${n(devices)})`);
  const seconds = (value: number | null) =>
    value === null ? '—' : value < 60 ? `${Math.round(value)} שנ׳` : `${(value / 60).toFixed(1)} דק׳`;

  const columns: AdminRecordColumn<BookEngagementRow>[] = [
    { key: 'title', header: 'ספר', render: (row) => row.title, cardHidden: true },
    { key: 'views', header: 'צפיות', render: (row) => `${n(row.views)} (${n(row.viewers)})`, className: 'tabular-nums' },
    { key: 'avgSeconds', header: 'זמן בעמוד', render: (row) => seconds(row.avgSeconds), className: 'tabular-nums' },
    { key: 'saves', header: 'שמירות', render: (row) => withDevices(row.saves, row.saveDevices), className: 'tabular-nums' },
    {
      key: 'addsToCart',
      header: 'הוספות לסל',
      render: (row) => withDevices(row.addsToCart, row.cartDevices),
      className: 'tabular-nums',
    },
    {
      key: 'externalSupplierClicks',
      header: 'מעבר לספק חיצוני',
      render: (row) =>
        row.externalSupplierClicks === 0
          ? '0'
          : `${withDevices(row.externalSupplierClicks, row.supplierDevices)}${row.supplierTargets ? ` · ${row.supplierTargets}` : ''}`,
    },
    {
      key: 'backInStockSubscribers',
      header: 'הודיעו לי כשיחזור',
      render: (row) => n(row.backInStockSubscribers),
      className: 'tabular-nums',
    },
    { key: 'unitsSold', header: 'יחידות שנמכרו', render: (row) => n(row.unitsSold), className: 'tabular-nums' },
    {
      key: 'revenue',
      header: 'הכנסה',
      render: (row) => formatPrice(row.revenue, 'he', { alwaysAgorot: true }),
      className: 'tabular-nums',
    },
  ];

  return (
    <AdminRecordList
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.bookId}
      href={(row) => `/admin/books/${row.bookId}`}
      renderCardTitle={(row) => row.title}
      renderCardBadge={(row) => <span className="admin-badge admin-badge-accent">{row.views} צפיות</span>}
      minWidthClassName="min-w-[64rem]"
      emptyMessage="אין נתוני עניין או מכירות בטווח שנבחר."
    />
  );
}
