/**
 * [1.5] ייצוא CSV גנרי — פונקציה טהורה (בלי I/O) כדי שתהיה שמישה גם
 * משרת (אין צורך כרגע) וגם מרכיב לקוח (CsvDownloadButton), בלי round-trip
 * נוסף לשרת: השורות כבר קיימות בעמוד לצורך התצוגה עצמה.
 *
 * [1.8] headers + rows-as-arrays של ערכים מוכנים (מחרוזת/מספר), לא
 * columns עם value(row) פונקציונלי: כשעמוד השרת (page.tsx, בלי
 * 'use client') בונה columns עם פונקציית value בתוך JSX ומעביר אותם
 * ל-CsvDownloadButton (מרכיב לקוח), Next זורק "Functions cannot be
 * passed directly to Client Components" — הפונקציה אינה ניתנת
 * לסריאליזציה דרך גבול שרת/לקוח. הפורמוט קורה בשרת ומיוצא כמערך ערכים
 * מוכן; הצד הלקוח רק מרכיב מחרוזת CSV משטוחה.
 */

function escapeCsvCell(raw: string): string {
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/** BOM בתחילת הקובץ — כדי ש-Excel יזהה UTF-8 ויציג עברית נכון ולא ג'יבריש. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const header = headers.map((h) => escapeCsvCell(h)).join(',');
  const lines = rows.map((row) => row.map((cell) => escapeCsvCell(String(cell ?? ''))).join(','));
  const bom = String.fromCharCode(0xfeff);
  return bom + [header, ...lines].join('\r\n');
}
