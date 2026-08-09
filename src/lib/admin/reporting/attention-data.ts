import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * [1.5] "הזמנות שדורשות טיפול" — דוח עבודה יומי, לא רק אנליטיקה (אחד
 * משלושת הדוחות שהוגדרו קריטיים ביותר מיום הפתיחה). מרכז כאן קטגוריות
 * שכבר קיימות כתצוגות שמורות ברשימת ההזמנות (commerce-queries.ts,
 * SAVED_VIEWS) יחד עם קטגוריות חדשות שאין להן תצוגה שמורה תואמת —
 * "בהכנה זמן רב" ו"טרם נשלח זמן רב" משתמשות ב-created_at כקירוב לזמן
 * הכניסה למצב (אין timestamp ייעודי per-axis על ההזמנה עצמה), ו"משלוח
 * באיחור" משווה למועד המובטח בפועל.
 */

const STALE_DAYS = 3;

export interface AttentionCounts {
  pendingPayment: number;
  paidNotActioned: number;
  preparingTooLong: number;
  unfulfilledTooLong: number;
  docMissing: number;
  shippedLate: number;
  amountOrReconcileMismatch: number;
  webhookFailures: number;
}

export interface OpenServiceRequestRow {
  id: string;
  orderId: string;
  orderNumber: number;
  kind: 'cancel' | 'return';
  status: 'open' | 'in_progress';
  requestedBy: 'customer' | 'staff';
  createdAt: string;
}

export interface AttentionReport {
  counts: AttentionCounts;
  openServiceRequests: OpenServiceRequestRow[];
  error: boolean;
}

export function emptyAttentionReport(error = false): AttentionReport {
  return {
    counts: {
      pendingPayment: 0,
      paidNotActioned: 0,
      preparingTooLong: 0,
      unfulfilledTooLong: 0,
      docMissing: 0,
      shippedLate: 0,
      amountOrReconcileMismatch: 0,
      webhookFailures: 0,
    },
    openServiceRequests: [],
    error,
  };
}

export async function getAttentionReport(): Promise<AttentionReport> {
  const supabase = await createClient();
  if (!supabase) return emptyAttentionReport(true);

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60_000).toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const service = createServiceClient();
  const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);

  const [
    pendingPayment,
    paidNotActioned,
    preparingTooLong,
    unfulfilledTooLong,
    docMissing,
    shippedLate,
    mismatch,
    webhookFailures,
    requestsRes,
  ] = await Promise.all([
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_state', 'pending')
        .eq('state', 'pending'),
    ),
    count(supabase.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'confirmed')),
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('fulfillment_state', 'preparing')
        .lt('created_at', staleCutoff),
    ),
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_state', 'paid')
        .eq('fulfillment_state', 'unfulfilled')
        .lt('created_at', staleCutoff),
    ),
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('payment_state', 'paid')
        .in('document_state', ['not_created', 'pending', 'failed']),
    ),
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('fulfillment_state', 'shipped')
        .not('promised_delivery_date', 'is', null)
        .lt('promised_delivery_date', today),
    ),
    count(
      supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .overlaps('tags', ['amount-mismatch', 'reconcile-mismatch']),
    ),
    service
      ? count(
          service
            .from('webhook_events')
            .select('id', { count: 'exact', head: true })
            .in('processing_status', ['failed', 'invalid_signature']),
        )
      : Promise.resolve(0),
    supabase
      .from('service_requests')
      .select('id, order_id, kind, status, requested_by, created_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: true })
      .limit(100),
  ]);

  // שאילתה שנייה במקום embed — אותו דפוס "שלוף מזהים, ואז שלוף את הקשור
  // אליהם" שכבר בשימוש ב-getSalesData (books לפי book_id).
  const requestRows = requestsRes.data ?? [];
  const orderIds = [...new Set(requestRows.map((r) => r.order_id))];
  const orderNumberById = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: relatedOrders } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
    for (const order of relatedOrders ?? []) orderNumberById.set(order.id, order.order_number);
  }

  const openServiceRequests: OpenServiceRequestRow[] = requestRows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: orderNumberById.get(row.order_id) ?? 0,
    kind: row.kind,
    status: row.status as 'open' | 'in_progress',
    requestedBy: row.requested_by,
    createdAt: row.created_at,
  }));

  return {
    counts: {
      pendingPayment,
      paidNotActioned,
      preparingTooLong,
      unfulfilledTooLong,
      docMissing,
      shippedLate,
      amountOrReconcileMismatch: mismatch,
      webhookFailures,
    },
    openServiceRequests,
    error: false,
  };
}
