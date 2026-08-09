import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { rangeFromDays } from './date-range';

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

/** אותו טריק בדיוק כמו startOfTodayIsrael ב-date-range.ts, ליום בודד. */
function israelDateKey(iso: string): string {
  const israelWallClock = new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const year = israelWallClock.getFullYear();
  const month = String(israelWallClock.getMonth() + 1).padStart(2, '0');
  const day = String(israelWallClock.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * [1.5] סדרת הכנסות/הזמנות יומית לגרף המכירות בדשבורד — כל יום בטווח,
 * גם בלי מכירות (ציר X רציף, כמו dailySeries באנליטיקס). קיבוץ לפי יום
 * קלנדרי בזמן ישראל, לא UTC: עקבי עם startOfTodayIsraelIso ועם שאר
 * ה"היום" בדשבורד — דוח כספים חייב להסכים עם שאר המסך על גבולות היום.
 * נוסחת ההכנסה (total-donation_amount) זהה לזו שב-sales-data.ts/gross.
 */
export async function getDailyRevenueTrend(days: number): Promise<RevenueTrendPoint[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const range = rangeFromDays(days);
  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total, donation_amount')
    .gte('created_at', range.from.toISOString())
    .lt('created_at', range.to.toISOString())
    .in('payment_state', ['paid', 'partially_refunded', 'refunded'])
    .limit(20000);

  if (error) {
    console.error('[reporting:trend] orders', error.message);
    return [];
  }

  const byDay = new Map<string, { revenue: number; orders: number }>();
  for (const row of data ?? []) {
    const key = israelDateKey(row.created_at);
    const bucket = byDay.get(key) ?? { revenue: 0, orders: 0 };
    bucket.revenue += Number(row.total) - Number(row.donation_amount ?? 0);
    bucket.orders += 1;
    byDay.set(key, bucket);
  }

  const series: RevenueTrendPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const dayInstant = new Date(range.from.getTime() + i * 24 * 60 * 60_000);
    const key = israelDateKey(dayInstant.toISOString());
    const bucket = byDay.get(key);
    series.push({ date: key, revenue: bucket?.revenue ?? 0, orders: bucket?.orders ?? 0 });
  }
  return series;
}
