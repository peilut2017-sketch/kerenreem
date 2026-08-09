'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * [1.5] טבלה מ-md ומעלה, כרטיסים מתחת — במקום גלילה אופקית על טבלה
 * רחבה (עדיין עובדת בזכות overflow-x-auto ב-.admin-table-wrap, אבל
 * לא נעימה לשימוש מהטלפון: מלקט/צוות שמסתכל ברשימת הזמנות מהנייד
 * צריך למצוא כל עמודה בגלילה אופקית). שתי התצוגות מוזנות מאותם columns —
 * מקור אחד לתוכן, לא שני רינדורים שיכולים להתפצל.
 */

export interface AdminRecordColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** מוסתרת בתצוגת הכרטיס — לשדה שכבר מופיע בבירור בכותרת/בתג הכרטיס */
  cardHidden?: boolean;
  className?: string;
}

export interface AdminRecordSelection<T> {
  isSelected: (row: T) => boolean;
  onToggle: (row: T) => void;
  onToggleAll: () => void;
  allSelected: boolean;
  label: (row: T) => string;
}

export function AdminRecordList<T>({
  rows,
  columns,
  getRowKey,
  renderCardTitle,
  renderCardBadge,
  href,
  selection,
  minWidthClassName = 'min-w-[48rem]',
  emptyMessage = 'אין רשומות להצגה.',
}: {
  rows: T[];
  columns: AdminRecordColumn<T>[];
  getRowKey: (row: T) => string;
  /** כותרת בולטת בכרטיס — בד״כ אותו תוכן כמו העמודה הראשונה בטבלה */
  renderCardTitle: (row: T) => ReactNode;
  renderCardBadge?: (row: T) => ReactNode;
  /** קישור אופציונלי לכל שורה — עוטף את הכרטיס ומדגיש את שם העמודה הראשונה בטבלה */
  href?: (row: T) => string | undefined;
  selection?: AdminRecordSelection<T>;
  minWidthClassName?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="admin-card px-5 py-8 text-center text-small text-muted">{emptyMessage}</div>
    );
  }

  return (
    <div className="admin-card admin-table-wrap">
      {/* טבלה — md ומעלה */}
      <table className={`admin-table hidden w-full ${minWidthClassName} text-small md:table`}>
        <thead>
          <tr className="border-b border-rule text-start text-caption text-muted">
            {selection ? (
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selection.allSelected}
                  onChange={selection.onToggleAll}
                  aria-label="בחירת כל השורות"
                  className="accent-[var(--admin-accent)]"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-start ${col.className ?? ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = getRowKey(row);
            const rowHref = href?.(row);
            return (
              <tr
                key={key}
                className={`border-b border-rule/60 transition-colors hover:bg-cream-2/50 ${
                  selection?.isSelected(row) ? 'bg-[var(--admin-accent-soft)]' : ''
                }`}
              >
                {selection ? (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selection.isSelected(row)}
                      onChange={() => selection.onToggle(row)}
                      aria-label={selection.label(row)}
                      className="accent-[var(--admin-accent)]"
                    />
                  </td>
                ) : null}
                {columns.map((col, i) => (
                  <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref} className="text-[var(--admin-accent)] hover:underline">
                        {col.render(row)}
                      </Link>
                    ) : (
                      col.render(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* כרטיסים — מתחת ל-md */}
      <ul className="divide-y divide-rule/60 md:hidden">
        {rows.map((row) => {
          const key = getRowKey(row);
          const rowHref = href?.(row);
          const cardColumns = columns.filter((c) => !c.cardHidden);
          return (
            <li
              key={key}
              className={`px-4 py-3.5 ${selection?.isSelected(row) ? 'bg-[var(--admin-accent-soft)]' : ''}`}
            >
              <div className="flex items-start gap-3">
                {selection ? (
                  <input
                    type="checkbox"
                    checked={selection.isSelected(row)}
                    onChange={() => selection.onToggle(row)}
                    aria-label={selection.label(row)}
                    className="mt-0.5 shrink-0 accent-[var(--admin-accent)]"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-semibold text-ink">
                      {rowHref ? (
                        <Link href={rowHref} className="text-[var(--admin-accent)] hover:underline">
                          {renderCardTitle(row)}
                        </Link>
                      ) : (
                        renderCardTitle(row)
                      )}
                    </div>
                    {renderCardBadge ? <div className="shrink-0">{renderCardBadge(row)}</div> : null}
                  </div>
                  <dl className="mt-2 space-y-1">
                    {cardColumns.map((col) => (
                      <div key={col.key} className="flex items-baseline justify-between gap-3 text-caption">
                        <dt className="shrink-0 text-muted">{col.header}</dt>
                        <dd className="min-w-0 truncate text-ink-soft">{col.render(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
