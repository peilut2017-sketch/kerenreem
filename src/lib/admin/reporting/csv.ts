/**
 * [1.5] ייצוא CSV גנרי — פונקציה טהורה (בלי I/O) כדי שתהיה שמישה גם
 * משרת (אין צורך כרגע) וגם מרכיב לקוח (CsvDownloadButton), בלי round-trip
 * נוסף לשרת: השורות כבר קיימות בעמוד לצורך התצוגה עצמה.
 */

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvCell(raw: string): string {
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** BOM בתחילת הקובץ — כדי ש-Excel יזהה UTF-8 ויציג עברית נכון ולא ג'יבריש. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => escapeCsvCell(String(c.value(row) ?? ''))).join(','));
  const bom = String.fromCharCode(0xfeff);
  return bom + [header, ...lines].join('\r\n');
}
