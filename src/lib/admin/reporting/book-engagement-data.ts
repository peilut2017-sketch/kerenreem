import 'server-only';
import type { ReportDateRange } from './date-range';
import { getSalesData } from './sales-data';
import { getBookStats } from '../analytics-queries';
import { createClient } from '@/lib/supabase/server';

/**
 * [1.6] "דוח ספרים" (ביקורת ט.7) — עונה על "איזה ספר להדפיס שוב": לא רק
 * מה נמכר (getSalesData, מקור האמת ליחידות/הכנסה) אלא גם מה מעניין
 * לקוחות שעדיין לא קנו — צפיות, שמירות, הוספות לסל, יציאה לספק חיצוני,
 * והרשמות "הודיעו לי כשיחזור למלאי" (האינדיקציה החזקה ביותר לביקוש שלא
 * נענה). ספר עם צפיות גבוהות ומכירות אפסיות שונה מהותית מספר שאיש לא
 * מסתכל עליו — שני המקרים נראים זהים ב"0 יחידות" בדוח מכירות בלבד.
 *
 * הצבירה במסד (analytics_book_stats), לא בזיכרון: הקריאה הקודמת נחתכה
 * ב-1000 שורות ולכן הספרים הנצפים ביותר נספרו חסר. צפיות הספר נגזרות
 * מ-page_views (כל צפיה, לא מכשיר ייחודי), והפעולות מ-commerce_events.
 */

export interface BookEngagementRow {
  bookId: string;
  title: string;
  price: number | null;
  stockQuantity: number;
  views: number;
  /** סשנים ייחודיים שצפו בעמוד הספר */
  viewers: number;
  avgSeconds: number | null;
  avgScroll: number | null;
  saves: number;
  saveDevices: number;
  addsToCart: number;
  cartDevices: number;
  backInStockSubscribers: number;
  /** [1.9] לחיצות על "רכישה דרך ספק חיצוני" — האינדיקציה לביקוש על ספר שלא נמכר אצלנו */
  externalSupplierClicks: number;
  supplierDevices: number;
  /** לאיזה ספקים יצאו מהספר: "אתר.co.il (3), ..." */
  supplierTargets: string;
  unitsSold: number;
  revenue: number;
}

export async function getBookEngagementReport(
  range: ReportDateRange,
): Promise<{ rows: BookEngagementRow[]; error: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { rows: [], error: true };

  let stats;
  try {
    stats = await getBookStats(range);
  } catch (error) {
    console.error('[reporting:books] stats', error);
    return { rows: [], error: true };
  }
  const sales = await getSalesData(range);

  const statsById = new Map(stats.map((row) => [row.bookId, row]));
  const salesByBookId = new Map(
    sales.items.filter((item) => item.bookId).map((item) => [item.bookId as string, item]),
  );

  const bookIds = [...new Set([...statsById.keys(), ...salesByBookId.keys()])];
  if (bookIds.length === 0) return { rows: [], error: false };

  const { data: books } = await supabase.from('books').select('id, title_he, price, stock_quantity').in('id', bookIds);
  const bookById = new Map((books ?? []).map((b) => [b.id, b]));

  const rows: BookEngagementRow[] = bookIds.map((bookId) => {
    const stat = statsById.get(bookId);
    const sale = salesByBookId.get(bookId);
    const book = bookById.get(bookId);
    return {
      bookId,
      title: book?.title_he ?? stat?.title ?? sale?.title ?? 'ספר שנמחק',
      price: book?.price ?? null,
      stockQuantity: book?.stock_quantity ?? 0,
      views: stat?.views ?? 0,
      viewers: stat?.viewers ?? 0,
      avgSeconds: stat?.avgSeconds ?? null,
      avgScroll: stat?.avgScroll ?? null,
      saves: stat?.saves ?? 0,
      saveDevices: stat?.saveDevices ?? 0,
      addsToCart: stat?.cartAdds ?? 0,
      cartDevices: stat?.cartDevices ?? 0,
      backInStockSubscribers: stat?.backInStock ?? 0,
      externalSupplierClicks: stat?.supplierClicks ?? 0,
      supplierDevices: stat?.supplierDevices ?? 0,
      supplierTargets: (stat?.supplierTargets ?? []).map((t) => `${t.host} (${t.clicks})`).join(', '),
      unitsSold: sale?.quantity ?? 0,
      revenue: sale?.revenue ?? 0,
    };
  });

  rows.sort((a, b) => b.views - a.views);
  return { rows, error: false };
}
