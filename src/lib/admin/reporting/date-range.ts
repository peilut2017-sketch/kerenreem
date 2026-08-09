/**
 * [1.5] טווח תאריכים אחיד לכל דוחות המסחר, עם חישוב "התקופה הקודמת"
 * להשוואה אוטומטית (דרישת האפיון: "כל דוח צריך לקבל... השוואה לתקופה
 * קודמת"). אזור זמן: ישראל, כמו startOfTodayIsraelIso בדשבורד הראשי —
 * אותה שיטת חישוב בדיוק, מוכללת כאן ל-N ימים אחורה במקום רק "היום".
 */

export interface ReportDateRange {
  /** תחילת הטווח (כולל), UTC */
  from: Date;
  /** סוף הטווח (לא כולל — תחילת היום שאחרי האחרון בטווח), UTC */
  to: Date;
  days: number;
  label: string;
}

export const RANGE_PRESETS = [7, 30, 90, 365] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

const PRESET_LABELS: Record<number, string> = {
  7: '7 ימים אחרונים',
  30: '30 ימים אחרונים',
  90: '90 ימים אחרונים',
  365: 'שנה אחרונה',
};

function startOfTodayIsrael(): Date {
  const now = new Date();
  const israelWallClock = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const offsetMs = now.getTime() - israelWallClock.getTime();
  israelWallClock.setHours(0, 0, 0, 0);
  return new Date(israelWallClock.getTime() + offsetMs);
}

/** טווח של N הימים האחרונים, עד סוף היום הנוכחי (זמן ישראל). */
export function rangeFromDays(days: number): ReportDateRange {
  const to = new Date(startOfTodayIsrael().getTime() + 24 * 60 * 60_000);
  const from = new Date(to.getTime() - days * 24 * 60 * 60_000);
  return { from, to, days, label: PRESET_LABELS[days] ?? `${days} ימים אחרונים` };
}

/** התקופה הקודמת באותו אורך בדיוק, מיד לפני תחילת הטווח הנתון. */
export function previousPeriod(range: ReportDateRange): ReportDateRange {
  const to = range.from;
  const from = new Date(to.getTime() - range.days * 24 * 60 * 60_000);
  return { from, to, days: range.days, label: 'התקופה הקודמת' };
}

export function parseRangeParam(daysParam: string | undefined): RangePreset {
  const n = Number(daysParam);
  return (RANGE_PRESETS as readonly number[]).includes(n) ? (n as RangePreset) : 30;
}

/** שינוי באחוזים: null כש-previous=0 וcurrent≠0 (חלוקה באפס חסרת משמעות, לא "אינסוף%"). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
