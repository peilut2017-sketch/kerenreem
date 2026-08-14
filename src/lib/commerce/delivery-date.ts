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

function isWorkingDay(date: Date, extraNonWorking: Set<string>): boolean {
  const day = date.getDay();
  // שישי (5) ושבת (6) אינם ימי עבודה
  if (day === 5 || day === 6) return false;
  if (extraNonWorking.has(toIsoDate(date))) return false;

  const events = HebrewCalendar.getHolidaysOnDate(new HDate(date), true) ?? [];
  return !events.some((event) => (event.getFlags() & CHAG_MASK) !== 0);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

/**
 * שעון הקיר הישראלי של רגע נתון, כ-Date שרכיביו המקומיים הם התאריך
 * והשעה בישראל. חישוב הימים חייב לרוץ בזמן ישראל: על שרת UTC, הזמנה
 * ב-01:30 לפנות בוקר שעון ישראל עוד שייכת ליום הקודם ב-UTC — והתאריך
 * המובטח יצא מוקדם ביום, לעתים על שישי/שבת.
 */
function israelWallClock(now: Date): Date {
  return new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
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
  // הצהריים מונעים גלישת-יום סביב מעברי שעון קיץ בזמן הצעידה
  const start = israelWallClock(now);
  start.setHours(12, 0, 0, 0);
  const landed = addBusinessDays(start, totalDays, settings.non_working_dates);
  // עיגון התוצאה לצהרי UTC של אותו תאריך: כך גם ‎.toISOString().slice(0,10)‎
  // (הצילום על ההזמנה) וגם Intl עם Asia/Jerusalem מציגים את אותו יום.
  return new Date(Date.UTC(landed.getFullYear(), landed.getMonth(), landed.getDate(), 12));
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
