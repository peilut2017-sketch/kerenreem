'use client';

import { toCsv } from '@/lib/admin/reporting/csv';

/** [1.5] הורדת CSV מהשורות שכבר מוצגות בעמוד — בלי round-trip נוסף לשרת. */
export function CsvDownloadButton({
  headers,
  rows,
  filename,
  label = 'ייצוא CSV',
}: {
  headers: string[];
  rows: (string | number | null | undefined)[][];
  filename: string;
  label?: string;
}) {
  function download() {
    const csv = toCsv(headers, rows);
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
