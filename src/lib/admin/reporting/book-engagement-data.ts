import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReportDateRange } from './date-range';
import { getSalesData } from './sales-data';

/**
 * [1.6] "דוח ספרים" (ביקורת ט.7) — commerce_events נכתבת מ-2025 עם עשרות
 * סוגי אירועים ואף מסך לא קרא ממנה אף פעם. זה הדוח שעונה על "איזה ספר
 * להדפיס שוב": לא רק מה נמכר (getSalesData, מקור אמת קיים ליחידות/הכנסה)
 * אלא גם מה מעניין לקוחות שעדיין לא קנו — צפיות, שמירות, הוספות לסל,
 * והרשמות "הודיעו לי כשיחזור למלאי" (האינדיקציה החזקה ביותר לביקוש
 * שלא נענה). ספר עם צפיות גבוהות ומכירות אפסיות שונה מהותית מספר
 * שאיש לא מסתכל עליו — שני המקרים נראים זהים ב"0 יחידות" בדוח מכירות בלבד.
 */

export interface BookEngagementRow {
  bookId: string;
  title: string;
  price: number | null;
  stockQuantity: number;
  views: number;
  saves: number;
  addsToCart: number;
  backInStockSubscribers: number;
  /** [1.9] לחיצות על "רכישה דרך ספק חיצוני" — האינדיקציה לביקוש על ספר שלא נמכר אצלנו */
  externalSupplierClicks: number;
  unitsSold: number;
  revenue: number;
}

const TRACKED_EVENTS = [
  'product_viewed',
  'product_saved',
  'product_added_to_cart',
  'back_in_stock_subscribed',
  'external_supplier_clicked',
];

export async function getBookEngagementReport(
  range: ReportDateRange,
): Promise<{ rows: BookEngagementRow[]; error: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: true };

  const [eventsRes, sales] = await Promise.all([
    supabase
      .from('commerce_events')
      .select('event_name, book_id')
      .in('event_name', TRACKED_EVENTS)
      .not('book_id', 'is', null)
      .gte('created_at', range.from.toISOString())
      .lt('created_at', range.to.toISOString())
      .limit(20000),
    getSalesData(range),
  ]);

  if (eventsRes.error) {
    console.error('[reporting:books] events', eventsRes.error.message);
    return { rows: [], error: true };
  }

  const counters = new Map<
    string,
    {
      views: number;
      saves: number;
      addsToCart: number;
      backInStockSubscribers: number;
      externalSupplierClicks: number;
    }
  >();
  for (const row of eventsRes.data ?? []) {
    const bookId = row.book_id;
    if (!bookId) continue;
    const entry =
      counters.get(bookId) ??
      { views: 0, saves: 0, addsToCart: 0, backInStockSubscribers: 0, externalSupplierClicks: 0 };
    if (row.event_name === 'product_viewed') entry.views += 1;
    else if (row.event_name === 'product_saved') entry.saves += 1;
    else if (row.event_name === 'product_added_to_cart') entry.addsToCart += 1;
    else if (row.event_name === 'back_in_stock_subscribed') entry.backInStockSubscribers += 1;
    else if (row.event_name === 'external_supplier_clicked') entry.externalSupplierClicks += 1;
    counters.set(bookId, entry);
  }

  const salesByBookId = new Map(
    sales.items.filter((item) => item.bookId).map((item) => [item.bookId as string, item]),
  );

  const bookIds = [...new Set([...counters.keys(), ...salesByBookId.keys()])];
  if (bookIds.length === 0) return { rows: [], error: false };

  const { data: books } = await supabase.from('books').select('id, title_he, price, stock_quantity').in('id', bookIds);
  const bookById = new Map((books ?? []).map((b) => [b.id, b]));

  const rows: BookEngagementRow[] = bookIds.map((bookId) => {
    const counts = counters.get(bookId);
    const sale = salesByBookId.get(bookId);
    const book = bookById.get(bookId);
    return {
      bookId,
      title: book?.title_he ?? sale?.title ?? 'ספר שנמחק',
      price: book?.price ?? null,
      stockQuantity: book?.stock_quantity ?? 0,
      views: counts?.views ?? 0,
      saves: counts?.saves ?? 0,
      addsToCart: counts?.addsToCart ?? 0,
      backInStockSubscribers: counts?.backInStockSubscribers ?? 0,
      externalSupplierClicks: counts?.externalSupplierClicks ?? 0,
      unitsSold: sale?.quantity ?? 0,
      revenue: sale?.revenue ?? 0,
    };
  });

  rows.sort((a, b) => b.views - a.views);
  return { rows, error: false };
}
