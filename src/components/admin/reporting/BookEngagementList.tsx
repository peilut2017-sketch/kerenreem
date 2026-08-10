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
  const columns: AdminRecordColumn<BookEngagementRow>[] = [
    { key: 'title', header: 'ספר', render: (row) => row.title, cardHidden: true },
    { key: 'views', header: 'צפיות', render: (row) => row.views.toLocaleString('he-IL'), className: 'tabular-nums' },
    {
      key: 'addsToCart',
      header: 'הוספות לסל',
      render: (row) => row.addsToCart.toLocaleString('he-IL'),
      className: 'tabular-nums',
    },
    { key: 'saves', header: 'שמירות', render: (row) => row.saves.toLocaleString('he-IL'), className: 'tabular-nums' },
    {
      key: 'backInStockSubscribers',
      header: 'הודיעו לי כשיחזור',
      render: (row) => row.backInStockSubscribers.toLocaleString('he-IL'),
      className: 'tabular-nums',
    },
    {
      key: 'externalSupplierClicks',
      header: 'לחיצות לספק חיצוני',
      render: (row) => row.externalSupplierClicks.toLocaleString('he-IL'),
      className: 'tabular-nums',
    },
    {
      key: 'unitsSold',
      header: 'יחידות שנמכרו',
      render: (row) => row.unitsSold.toLocaleString('he-IL'),
      className: 'tabular-nums',
    },
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
      minWidthClassName="min-w-[48rem]"
      emptyMessage="אין נתוני עניין או מכירות בטווח שנבחר."
    />
  );
}
