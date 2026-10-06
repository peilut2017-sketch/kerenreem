import type { ReactNode } from 'react';

/**
 * טבלת נתונים פשוטה לדוחות האנליטיקס — שרת בלבד. numeric = אינדקסי עמודות
 * מספריות (מיושרות לקצה ובגופן טבלאי). הטבלה גוללת אופקית במסך צר.
 */
export function AnalyticsTable({
  headers,
  rows,
  numeric = [],
  emptyLabel = 'אין עדיין מספיק נתונים בטווח שנבחר.',
}: {
  headers: string[];
  rows: ReactNode[][];
  numeric?: number[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-small text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="admin-table-wrap overflow-x-auto">
      <table className="admin-table min-w-[36rem]">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={header} scope="col" className={numeric.includes(index) ? 'text-end' : undefined}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, index) => (
                <td key={index} className={numeric.includes(index) ? 'text-end tabular-nums' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
