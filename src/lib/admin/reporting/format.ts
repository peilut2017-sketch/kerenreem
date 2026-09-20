/** [1.5] "12%▲ מהתקופה הקודמת" — עיצוב אחיד להשוואה שמופיעה כ-hint על StatTile. */
export function formatDeltaHint(percent: number | null, previousLabel = 'מהתקופה הקודמת'): string | undefined {
  if (percent === null) return `אין נתון בתקופה הקודמת להשוואה`;
  const rounded = Math.round(percent);
  if (rounded === 0) return `ללא שינוי ${previousLabel}`;
  const arrow = rounded > 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(rounded)}% ${previousLabel}`;
}

const ADMIN_DATE_STYLES = {
  /** 3.9.2026 */
  date: { dateStyle: 'short' },
  /** 3.9.2026, 14:05 */
  dateTime: { dateStyle: 'short', timeStyle: 'short' },
  /** 3 בספט׳ 2026 */
  medium: { dateStyle: 'medium' },
  /** 3 בספטמבר 2026 */
  long: { dateStyle: 'long' },
  /** 3 בספטמבר 2026 בשעה 14:05 */
  longDateTime: { dateStyle: 'long', timeStyle: 'short' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>;

export type AdminDateStyle = keyof typeof ADMIN_DATE_STYLES;

const formatters = new Map<AdminDateStyle, Intl.DateTimeFormat>();

/**
 * תאריך/שעה בממשק הניהול — עברית, ותמיד באזור הזמן של ישראל: השרת
 * (Vercel) רץ ב-UTC, וקריאה בלי timeZone הציגה יום שגוי בין חצות
 * לשלוש לפנות בוקר. ערך ריק/לא תקין ⇒ מחרוזת ריקה, לא "Invalid Date".
 */
export function formatAdminDate(
  value: string | number | Date | null | undefined,
  style: AdminDateStyle = 'date',
): string {
  if (value == null || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  let formatter = formatters.get(style);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('he-IL', { ...ADMIN_DATE_STYLES[style], timeZone: 'Asia/Jerusalem' });
    formatters.set(style, formatter);
  }
  return formatter.format(date);
}
