'use client';

import { toCsv, type CsvColumn } from '@/lib/admin/reporting/csv';

/** [1.5] הורדת CSV מהשורות שכבר מוצגות בעמוד — בלי round-trip נוסף לשרת. */
export function CsvDownloadButton<T>({
  rows,
  columns,
  filename,
  label = 'ייצוא CSV',
}: {
  rows: T[];
  columns: CsvColumn<T>[];
  filename: string;
  label?: string;
}) {
  function download() {
    const csv = toCsv(rows, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows.length === 0}
      className="admin-btn admin-btn-quiet"
    >
      {label}
    </button>
  );
}
