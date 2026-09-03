import { HDate, HebrewCalendar, flags } from '@hebcal/core';
import type { StoreSettings } from '@/lib/supabase/types';

/**
 * מנוע תאריך האספקה (פרק 11.4 במסמך האב):
 *   תאריך = היום + זמן הכנה + ימי שילוח לפי השיטה + מרווח ביטחון,
 * בדילוג על ימים שאינם ימי עבודה: שישי, שבת, חגים וערבי חג (מחושבים
 * מ-hebcal, לוח ישראל), ותאריכים ידניים מ-store_settings.non_working_dates
 * (בין-הזמנים, ספירת מלאי וכד').
 *
 * הערך המחושב מוצג בעגלה, ב-Checkout, במייל ובעמוד המעקב — ומוצלם על
 * ההזמנה (promised_delivery_date): ההבטחה ללקוח אינה זזה רטרואקטיבית.
 */

const CHAG_MASK = flags.CHAG | flags.EREV | flags.YOM_TOV_ENDS;

/**
 * כל חשבון היום נעשה בזמן ירושלים, לא בזמן השרת: ב-Vercel השרת רץ ב-UTC,
 * והזמנה ב-01:00 בלילה בישראל היא עדיין "אתמול" ב-UTC — כך שדילוג שישי/
 * שבת/ערב חג התייחס ליום הלא נכון, והתאריך שנשמר (promised_delivery_date)
 * היה שונה ביום מהכיתוב שהוצג ללקוח (formatPromisedDate, שכן מוצג
 * בזמן ירושלים).
 */
const JERUSALEM_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Jerusalem',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function jerusalemParts(date: Date): { y: number; m: number; d: number; weekday: number } {
  const parts = Object.fromEntries(JERUSALEM_PARTS.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    weekday: WEEKDAYS.indexOf(parts.weekday),
  };
}

function isWorkingDay(date: Date, extraNonWorking: Set<string>): boolean {
  const { y, m, d, weekday } = jerusalemParts(date);
  // שישי (5) ושבת (6) אינם ימי עבודה
  if (weekday === 5 || weekday === 6) return false;
  if (extraNonWorking.has(toIsoDate(date))) return false;

  // HDate מ-Date קורא רכיבי זמן מקומיים — לכן נבנה Date מקומי מהרכיבים
  // הירושלמיים (בצהריים, רחוק מגבולות יום), ולא מה-Date המקורי.
  const events = HebrewCalendar.getHolidaysOnDate(new HDate(new Date(y, m - 1, d, 12)), true) ?? [];
  return !events.some((event) => (event.getFlags() & CHAG_MASK) !== 0);
}

function toIsoDate(date: Date): string {
  const { y, m, d } = jerusalemParts(date);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** מוסיפה n ימי עבודה לתאריך, מדלגת על ימים שאינם ימי עבודה. */
export function addBusinessDays(start: Date, days: number, nonWorkingDates: string[] = []): Date {
  const extra = new Set(nonWorkingDates);
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result, extra)) remaining -= 1;
  }
  // אם הנחיתה על יום שאינו יום עבודה (days=0 או תאריך פתיחה) — גלישה קדימה
  while (!isWorkingDay(result, extra)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

export interface PromisedDateInput {
  settings: Pick<
    StoreSettings,
    'order_prep_days' | 'delivery_buffer_days' | 'non_working_dates' | 'pickup_prep_hours'
  >;
  /** ימי השילוח של השיטה שנבחרה (0 לאיסוף עצמי) */
  etaBusinessDays: number;
  /** דריסת זמן הכנה פר-ספר — הגבוה מבין הפריטים בהזמנה */
  prepDaysOverride?: number | null;
  isPickup?: boolean;
  now?: Date;
}

export function getPromisedDate({
  settings,
  etaBusinessDays,
  prepDaysOverride,
  isPickup = false,
  now = new Date(),
}: PromisedDateInput): Date {
  const prepDays = Math.max(settings.order_prep_days, prepDaysOverride ?? 0);
  const totalDays = isPickup
    ? Math.max(prepDays, Math.ceil(settings.pickup_prep_hours / 24))
    : prepDays + etaBusinessDays + settings.delivery_buffer_days;
  return addBusinessDays(now, totalDays, settings.non_working_dates);
}

/** "יגיע עד יום שלישי, 18.8" — תאריך, לא טווח ימי עסקים (פרק 3.3). */
export function formatPromisedDate(date: Date, locale: string = 'he'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IL' : 'he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Asia/Jerusalem',
  }).format(date);
}

export { toIsoDate };
