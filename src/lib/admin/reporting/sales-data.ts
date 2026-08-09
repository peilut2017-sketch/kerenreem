import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReportDateRange } from './date-range';

/**
 * [1.5/סבב 1.5-18] מקור נתוני המכירות/רווחיות — משותף לדוח "מכירות
 * והכנסות" ולדוח "רווחיות", כדי ששני הדוחות תמיד יסכימו על אותם מספרים
 * (עיקרון האפיון: "לכל מדד צריך להיות מקור אמת מוגדר").
 *
 * מתקן שני באגים שהיו בגרסה הקודמת (הדוח המאוחד הישן):
 *  1. order_items נשלף בעבר עם limit(8000) גלובלי, בלי order-by ובלי
 *     סינון לפי ההזמנות שבטווח — מעבר ל-8,000 שורות ההיסטוריה המצטברת
 *     (לא בטווח!) חלק מהפריטים "נעלמו" בשקט מהדוח, וה-8,000 שכן חזרו
 *     היו תלויים בסדר שרירותי של Postgres. כאן: קודם ההזמנות ששולמו
 *     בטווח, ואז order_items מסונן ל-order_id שלהן בלבד — תמיד מדויק,
 *     לא משנה כמה שורות היסטוריה יש בטבלה.
 *  2. "ספרים מובילים"/רווחיות קובצו לפי title_snapshot: שני ספרים שונים
 *     עם אותו שם התמזגו לשורה אחת, וספר שהשם שלו תוקן התפצל לשתי שורות
 *     (הזמנות ישנות עם הצילום הישן, חדשות עם השם הנוכחי). כאן: קיבוץ
 *     לפי book_id, עם הכותרת הנוכחית מטבלת books — ורק פריט יתום (בלי
 *     book_id, למשל ספר שנמחק) נופל חזרה ל-title_snapshot.
 */

export interface SalesItemAgg {
  key: string;
  bookId: string | null;
  title: string;
  quantity: number;
  revenue: number;
  /** סכום עלות רק על היחידות שיש להן cost_price_snapshot מתועד */
  cost: number;
  /** כמה מתוך quantity תרמו ל-cost (השאר — ללא עלות מתועדת) */
  costedQuantity: number;
}

export interface SalesData {
  paidOrdersCount: number;
  gross: number;
  donations: number;
  discountTotal: number;
  shippingTotal: number;
  refunds: number;
  net: number;
  units: number;
  aov: number;
  methodCounts: Map<string, number>;
  items: SalesItemAgg[];
  error: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  bit: 'ביט',
  credit: 'אשראי',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  manual_external: 'תשלום חיצוני',
};

export function emptySalesData(error = false): SalesData {
  return {
    paidOrdersCount: 0,
    gross: 0,
    donations: 0,
    discountTotal: 0,
    shippingTotal: 0,
    refunds: 0,
    net: 0,
    units: 0,
    aov: 0,
    methodCounts: new Map(),
    items: [],
    error,
  };
}

export async function getSalesData(range: ReportDateRange): Promise<SalesData> {
  const supabase = await createClient();
  if (!supabase) return emptySalesData(true);

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, total, donation_amount, discount_total, shipping_total')
    .gte('created_at', range.from.toISOString())
    .lt('created_at', range.to.toISOString())
    .in('payment_state', ['paid', 'partially_refunded', 'refunded'])
    .order('created_at', { ascending: false })
    .limit(20000);
  if (ordersError) {
    console.error('[reporting:sales] orders', ordersError.message);
    return emptySalesData(true);
  }

  const orderIds = (orders ?? []).map((o) => o.id);

  const [itemsRes, paymentsRes] = await Promise.all([
    orderIds.length > 0
      ? supabase
          .from('order_items')
          .select('order_id, book_id, title_snapshot, quantity, line_total, cost_price_snapshot')
          .in('order_id', orderIds)
          .order('id', { ascending: true })
          .limit(20000)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('payments')
      .select('kind, status, method, amount')
      .gte('created_at', range.from.toISOString())
      .lt('created_at', range.to.toISOString())
      .limit(4000),
  ]);

  const items = itemsRes.data ?? [];
  const payments = paymentsRes.data ?? [];

  // כותרת נוכחית מהקטלוג לכל book_id שמופיע — כדי לא לפצל ספר שהשם שלו תוקן
  const bookIds = [...new Set(items.map((i) => i.book_id).filter((id): id is string => Boolean(id)))];
  const titleByBookId = new Map<string, string>();
  if (bookIds.length > 0) {
    const { data: books } = await supabase.from('books').select('id, title_he').in('id', bookIds);
    for (const book of books ?? []) titleByBookId.set(book.id, book.title_he);
  }

  const aggByKey = new Map<string, SalesItemAgg>();
  for (const item of items) {
    const key = item.book_id ?? `orphan:${item.title_snapshot ?? item.order_id}`;
    const title = (item.book_id ? titleByBookId.get(item.book_id) : null) ?? item.title_snapshot ?? 'ללא שם';
    const agg = aggByKey.get(key) ?? {
      key,
      bookId: item.book_id,
      title,
      quantity: 0,
      revenue: 0,
      cost: 0,
      costedQuantity: 0,
    };
    agg.quantity += item.quantity;
    agg.revenue += Number(item.line_total ?? 0);
    if (item.cost_price_snapshot != null) {
      agg.cost += Number(item.cost_price_snapshot) * item.quantity;
      agg.costedQuantity += item.quantity;
    }
    aggByKey.set(key, agg);
  }

  const gross = (orders ?? []).reduce((sum, o) => sum + Number(o.total) - Number(o.donation_amount ?? 0), 0);
  const donations = (orders ?? []).reduce((sum, o) => sum + Number(o.donation_amount ?? 0), 0);
  const discountTotal = (orders ?? []).reduce((sum, o) => sum + Number(o.discount_total ?? 0), 0);
  const shippingTotal = (orders ?? []).reduce((sum, o) => sum + Number(o.shipping_total ?? 0), 0);
  const refunds = payments
    .filter((p) => p.kind === 'refund' && p.status === 'succeeded')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const units = items.reduce((sum, i) => sum + i.quantity, 0);

  const methodCounts = new Map<string, number>();
  for (const payment of payments) {
    if (payment.kind !== 'charge' || payment.status !== 'succeeded') continue;
    const label = METHOD_LABELS[payment.method ?? ''] ?? 'לא ידוע';
    methodCounts.set(label, (methodCounts.get(label) ?? 0) + 1);
  }

  return {
    paidOrdersCount: orders?.length ?? 0,
    gross,
    donations,
    discountTotal,
    shippingTotal,
    refunds,
    net: gross - refunds,
    units,
    aov: (orders?.length ?? 0) > 0 ? gross / (orders?.length ?? 1) : 0,
    methodCounts,
    items: [...aggByKey.values()],
    error: false,
  };
}
