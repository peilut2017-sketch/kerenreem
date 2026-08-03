import 'server-only';
import { createClient } from '@/lib/supabase/server';

async function client() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase אינו מוגדר');
  return supabase;
}

export interface DailyPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  dailySeries: DailyPoint[];
  topReferrers: { host: string; views: number }[];
  localeBreakdown: { locale: string; views: number }[];
}

const EMPTY_SUMMARY: AnalyticsSummary = {
  totalViews: 0,
  uniqueVisitors: 0,
  topPages: [],
  dailySeries: [],
  topReferrers: [],
  localeBreakdown: [],
};

/**
 * שאילתה אחת שמביאה את כל השורות הגולמיות בטווח, וכל הסיכומים (עמודים
 * מובילים, מפנים, פילוח שפה, סדרת ימים) נחשבים כאן בזיכרון — כמו
 * countBooksByCategory ב-queries.ts. לאתר מוסדי (לא חנות המונים) זה
 * טווח נתונים סביר גם לחלון של חודש, ולא מצדיק view או RPC ב-Postgres
 * רק בשביל GROUP BY.
 */
export async function getAnalyticsSummary(days: number): Promise<AnalyticsSummary> {
  const supabase = await client();
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('page_views')
    .select('path, locale, referrer_host, visitor_hash, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) {
    console.error('[analytics:getAnalyticsSummary]', error.code, error.message);
    return EMPTY_SUMMARY;
  }

  const rows = (data ?? []) as {
    path: string;
    locale: string;
    referrer_host: string | null;
    visitor_hash: string;
    created_at: string;
  }[];

  const pageCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const localeCounts = new Map<string, number>();
  const dayBuckets = new Map<string, { views: number; visitors: Set<string> }>();

  for (const row of rows) {
    pageCounts.set(row.path, (pageCounts.get(row.path) ?? 0) + 1);
    localeCounts.set(row.locale, (localeCounts.get(row.locale) ?? 0) + 1);

    if (row.referrer_host) {
      referrerCounts.set(row.referrer_host, (referrerCounts.get(row.referrer_host) ?? 0) + 1);
    }

    const day = row.created_at.slice(0, 10);
    const bucket = dayBuckets.get(day) ?? { views: 0, visitors: new Set<string>() };
    bucket.views += 1;
    bucket.visitors.add(row.visitor_hash);
    dayBuckets.set(day, bucket);
  }

  // כל יום בטווח, גם בלי ביקורים — כדי שגרף המגמה יהיה ציר X רציף ולא ידלג ימים ריקים
  const dailySeries: DailyPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(since);
    date.setDate(date.getDate() + i);
    const key = date.toISOString().slice(0, 10);
    const bucket = dayBuckets.get(key);
    dailySeries.push({ date: key, views: bucket?.views ?? 0, uniqueVisitors: bucket?.visitors.size ?? 0 });
  }

  const topN = <T,>(map: Map<string, number>, n: number, toItem: (key: string, count: number) => T): T[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([key, count]) => toItem(key, count));

  return {
    totalViews: rows.length,
    uniqueVisitors: new Set(rows.map((row) => row.visitor_hash)).size,
    topPages: topN(pageCounts, 10, (path, views) => ({ path, views })),
    dailySeries,
    topReferrers: topN(referrerCounts, 8, (host, views) => ({ host, views })),
    localeBreakdown: topN(localeCounts, 6, (locale, views) => ({ locale, views })),
  };
}
