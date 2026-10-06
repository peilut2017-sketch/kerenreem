import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReportDateRange } from './reporting/date-range';

/**
 * שאילתות האנליטיקס העצמאית. כל הצבירה נעשית ב-Postgres (פונקציות
 * analytics_* ב-57_analytics_v2.sql) ולא בזיכרון: הגרסה הקודמת משכה את
 * כל שורות הצפיות עם .limit(20000), אבל PostgREST חותך כל תשובה ב-1000
 * שורות בשקט — ולכן הסכום "נתקע" על 1000. עכשיו מגיעות לכאן רק תוצאות
 * מצטברות (עשרות שורות), שאינן יכולות להיחתך.
 */

async function client() {
  const supabase = await createClient();
  if (!supabase) throw new Error('Supabase אינו מוגדר');
  return supabase;
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

function rangeArgs(range: ReportDateRange) {
  return { p_from: range.from.toISOString(), p_to: range.to.toISOString() };
}

type Row = Record<string, unknown>;

async function rpc(name: string, args: Record<string, unknown>): Promise<Row[]> {
  const supabase = await client();
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[analytics:${name}]`, error.code, error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as Row[];
}

export interface AnalyticsOverview {
  views: number;
  sessions: number;
  visitorDays: number;
  avgSessionSeconds: number;
  avgPageSeconds: number;
  bounceRate: number;
  pagesPerSession: number;
  botViews: number;
  /** שיעור הצפיות שנמדד להן משך שהייה (נתוני עבר לפני v2 אינם נמדדים) */
  measuredShare: number;
}

export async function getOverview(range: ReportDateRange): Promise<AnalyticsOverview> {
  const [row] = await rpc('analytics_overview', rangeArgs(range));
  return {
    views: num(row?.views),
    sessions: num(row?.sessions),
    visitorDays: num(row?.visitor_days),
    avgSessionSeconds: num(row?.avg_session_seconds),
    avgPageSeconds: num(row?.avg_page_seconds),
    bounceRate: num(row?.bounce_rate),
    pagesPerSession: num(row?.pages_per_session),
    botViews: num(row?.bot_views),
    measuredShare: num(row?.measured_share),
  };
}

export interface DailyPoint {
  date: string;
  views: number;
  sessions: number;
  visitors: number;
}

export async function getDaily(range: ReportDateRange): Promise<DailyPoint[]> {
  const rows = await rpc('analytics_daily', rangeArgs(range));
  return rows.map((row) => ({
    date: String(row.day),
    views: num(row.views),
    sessions: num(row.sessions),
    visitors: num(row.visitors),
  }));
}

export interface PageRow {
  path: string;
  views: number;
  sessions: number;
  avgSeconds: number | null;
  avgScroll: number | null;
  entries: number;
  exits: number;
}

export async function getPages(range: ReportDateRange, limit = 100): Promise<PageRow[]> {
  const rows = await rpc('analytics_pages', { ...rangeArgs(range), p_limit: limit });
  return rows.map((row) => ({
    path: String(row.path),
    views: num(row.views),
    sessions: num(row.sessions),
    avgSeconds: row.avg_seconds == null ? null : num(row.avg_seconds),
    avgScroll: row.avg_scroll == null ? null : num(row.avg_scroll),
    entries: num(row.entries),
    exits: num(row.exits),
  }));
}

export type BreakdownDim =
  | 'channel'
  | 'referrer'
  | 'utm_source'
  | 'utm_medium'
  | 'utm_campaign'
  | 'device'
  | 'country'
  | 'locale'
  | 'entry_path';

export interface BreakdownRow {
  label: string;
  views: number;
  sessions: number;
}

export async function getBreakdown(range: ReportDateRange, dim: BreakdownDim, limit = 15): Promise<BreakdownRow[]> {
  const rows = await rpc('analytics_breakdown', { ...rangeArgs(range), p_dim: dim, p_limit: limit });
  return rows.map((row) => ({ label: String(row.label), views: num(row.views), sessions: num(row.sessions) }));
}

export interface OutboundRow {
  kind: 'external' | 'tel' | 'mailto' | 'download';
  target: string | null;
  fromPath: string;
  clicks: number;
  sessions: number;
}

export async function getOutbound(range: ReportDateRange): Promise<OutboundRow[]> {
  const rows = await rpc('analytics_outbound', rangeArgs(range));
  return rows.map((row) => ({
    kind: row.kind as OutboundRow['kind'],
    target: (row.target as string | null) ?? null,
    fromPath: String(row.from_path),
    clicks: num(row.clicks),
    sessions: num(row.sessions),
  }));
}

export interface FlowRow {
  from: string;
  to: string;
  transitions: number;
}

export async function getFlow(range: ReportDateRange, limit = 20): Promise<FlowRow[]> {
  const rows = await rpc('analytics_flow', { ...rangeArgs(range), p_limit: limit });
  return rows.map((row) => ({ from: String(row.from_path), to: String(row.to_path), transitions: num(row.transitions) }));
}

export interface HourCell {
  dow: number;
  hour: number;
  views: number;
}

export async function getHours(range: ReportDateRange): Promise<HourCell[]> {
  const rows = await rpc('analytics_hours', rangeArgs(range));
  return rows.map((row) => ({ dow: num(row.dow), hour: num(row.hour), views: num(row.views) }));
}

export interface BookStatsRow {
  bookId: string;
  slug: string;
  title: string;
  views: number;
  viewers: number;
  avgSeconds: number | null;
  avgScroll: number | null;
  saves: number;
  saveDevices: number;
  cartAdds: number;
  cartDevices: number;
  supplierClicks: number;
  supplierDevices: number;
  backInStock: number;
  /** לאיזה ספקים יצאו מהספר הזה: host → לחיצות */
  supplierTargets: { host: string; clicks: number }[];
}

export async function getBookStats(range: ReportDateRange): Promise<BookStatsRow[]> {
  const [rows, targets] = await Promise.all([
    rpc('analytics_book_stats', rangeArgs(range)),
    rpc('analytics_book_outbound', rangeArgs(range)),
  ]);
  const byBook = new Map<string, { host: string; clicks: number }[]>();
  for (const row of targets) {
    const list = byBook.get(String(row.book_id)) ?? [];
    list.push({ host: String(row.target ?? ''), clicks: num(row.clicks) });
    byBook.set(String(row.book_id), list);
  }
  return rows.map((row) => ({
    bookId: String(row.book_id),
    slug: String(row.slug),
    title: String(row.title),
    views: num(row.views),
    viewers: num(row.viewers),
    avgSeconds: row.avg_seconds == null ? null : num(row.avg_seconds),
    avgScroll: row.avg_scroll == null ? null : num(row.avg_scroll),
    saves: num(row.saves),
    saveDevices: num(row.save_devices),
    cartAdds: num(row.cart_adds),
    cartDevices: num(row.cart_devices),
    supplierClicks: num(row.supplier_clicks),
    supplierDevices: num(row.supplier_devices),
    backInStock: num(row.back_in_stock),
    supplierTargets: (byBook.get(String(row.book_id)) ?? []).sort((a, b) => b.clicks - a.clicks),
  }));
}
