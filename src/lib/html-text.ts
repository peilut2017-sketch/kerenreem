/**
 * המרת HTML לטקסט לתצוגה מקוצרת ולחיפוש.
 *
 * מודול נפרד מהמנקה במכוון: המנקה תלוי ב-sanitize-html, וייבוא ממנו לתוך
 * רכיב לקוח היה גורר את כל הספרייה לחבילת הדפדפן — בדיוק המשקל שהוצא
 * משם קודם. כאן אין שום תלות.
 */
export function htmlToPlainText(html: string | null | undefined, maxLength = 200): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s\S*$/, '')}\u2026`;
}
