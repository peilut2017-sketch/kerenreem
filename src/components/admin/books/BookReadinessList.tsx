'use client';

import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';
import type { BookRow } from '@/lib/admin/queries';
import type { CompletionItem } from '@/lib/completion';

export interface ReadinessRow {
  book: BookRow;
  missing: CompletionItem[];
  percent: number;
}

/**
 * [1.8] עטיפת לקוח דקה סביב AdminRecordList — ראו BookEngagementList
 * להסבר המלא: columns/getRowKey/href הם פונקציות, ועמוד השרת (books/
 * readiness/page.tsx) לא יכול להעביר אותן ישירות ל-AdminRecordList
 * (מרכיב לקוח) בלי לשבור את גבול השרת/לקוח.
 */
export function BookReadinessList({ rows }: { rows: ReadinessRow[] }) {
  const columns: AdminRecordColumn<ReadinessRow>[] = [
    {
      key: 'title',
      header: 'ספר',
      render: (row) => row.book.title_he,
      cardHidden: true,
    },
    {
      key: 'author',
      header: 'מחבר',
      render: (row) => row.book.author?.name_he ?? row.book.author_name_he ?? '—',
    },
    {
      key: 'missing',
      header: 'חסר',
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.missing.map((item) => (
            <span key={item.key} className="admin-badge admin-badge-warning">
              {item.label}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'percent',
      header: 'שלמות',
      render: (row) => `${row.percent}%`,
      cardHidden: true,
    },
  ];

  return (
    <AdminRecordList
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.book.id}
      href={(row) => `/admin/books/${row.book.id}`}
      renderCardTitle={(row) => row.book.title_he}
      renderCardBadge={(row) => <span className="admin-badge admin-badge-warning">{row.percent}%</span>}
      minWidthClassName="min-w-[36rem]"
      emptyMessage="אין ספרים חסרים."
    />
  );
}
