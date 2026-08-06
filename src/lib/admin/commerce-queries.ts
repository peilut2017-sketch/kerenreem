import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  CommerceDocument,
  InventoryLevel,
  NotificationLogEntry,
  Order,
  OrderEvent,
  OrderItem,
  Payment,
} from '@/lib/supabase/types';

/**
 * שאילתות הצוות למסכי המסחר — דרך ה-session client, תחת ה-RLS של
 * הצוות (orders_own_read עם can_edit, ‏payments_staff_read וכו').
 * אין כאן service role: מה שהצוות רואה הוא מה שה-RLS מתיר.
 */

export interface OrdersFilter {
  q?: string;
  state?: string;
  payment?: string;
  fulfillment?: string;
  view?: string;
}

/** התצוגות השמורות (פרק 9.3) — שם ← תנאי סינון. */
export const SAVED_VIEWS: Record<string, { label: string; filter: Partial<OrdersFilter> }> = {
  pending_payment: { label: 'ממתינות לתשלום', filter: { payment: 'pending' } },
  new: { label: 'חדשות לטיפול', filter: { state: 'confirmed' } },
  preparing: { label: 'בהכנה', filter: { fulfillment: 'preparing' } },
  ready_pickup: { label: 'ממתינות לאיסוף', filter: { fulfillment: 'ready_for_pickup' } },
  shipped: { label: 'נשלחו', filter: { fulfillment: 'shipped' } },
  doc_missing: { label: 'תשלום ללא מסמך', filter: { view: 'doc_missing' } },
  cancel_requests: { label: 'בקשות ביטול', filter: { view: 'cancel_requests' } },
  attention: { label: 'דורשות טיפול', filter: { view: 'attention' } },
};

export async function listOrders(filter: OrdersFilter): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);

  if (filter.state) query = query.eq('state', filter.state);
  if (filter.payment) query = query.eq('payment_state', filter.payment);
  if (filter.fulfillment) query = query.eq('fulfillment_state', filter.fulfillment);
  if (filter.view === 'doc_missing') {
    query = query.eq('payment_state', 'paid').in('document_state', ['not_created', 'pending', 'failed']);
  }
  if (filter.view === 'cancel_requests') {
    query = query.overlaps('tags', ['cancel-requested']);
  }
  if (filter.view === 'attention') {
    query = query.overlaps('tags', ['amount-mismatch', 'attention']);
  }
  if (filter.q) {
    const q = filter.q.trim();
    const asNumber = Number(q);
    query = Number.isInteger(asNumber) && asNumber > 0
      ? query.eq('order_number', asNumber)
      : query.or(
          `contact_name.ilike.%${q}%,contact_email.ilike.%${q}%,contact_phone.ilike.%${q}%`,
        );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[admin:orders] list', error.message);
    return [];
  }
  return (data ?? []) as Order[];
}

export interface OrderDetail {
  order: Order;
  items: OrderItem[];
  events: OrderEvent[];
  payments: Payment[];
  documents: CommerceDocument[];
  notifications: NotificationLogEntry[];
}

export async function getOrderDetail(orderId: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();
  if (error || !order) return null;

  const [items, events, payments, documents, notifications] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', orderId),
    supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('payments').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('documents').select('*').eq('order_id', orderId).order('created_at'),
    supabase.from('notification_log').select('*').eq('order_id', orderId).order('created_at'),
  ]);

  return {
    order: order as Order,
    items: (items.data ?? []) as OrderItem[],
    events: (events.data ?? []) as OrderEvent[],
    payments: (payments.data ?? []) as Payment[],
    documents: (documents.data ?? []) as CommerceDocument[],
    notifications: (notifications.data ?? []) as NotificationLogEntry[],
  };
}

export interface InventoryRow {
  bookId: string;
  title: string;
  sku: string | null;
  stockLocation: string | null;
  isPurchasable: boolean;
  isStockManaged: boolean;
  onHand: number;
  reserved: number;
  available: number;
  lowThreshold: number | null;
}

export async function listInventory(): Promise<InventoryRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const [{ data: books }, { data: levels }] = await Promise.all([
    supabase
      .from('books')
      .select('id, title_he, sku, stock_location, is_purchasable, is_stock_managed, low_stock_threshold, stock_quantity')
      .order('title_he'),
    supabase.from('inventory_levels').select('*'),
  ]);

  const levelByBook = new Map<string, InventoryLevel>();
  for (const level of (levels ?? []) as InventoryLevel[]) {
    levelByBook.set(level.book_id, level);
  }

  return (books ?? []).map((book) => {
    const level = levelByBook.get(book.id);
    const onHand = level?.on_hand ?? book.stock_quantity ?? 0;
    const reserved = level?.reserved ?? 0;
    return {
      bookId: book.id,
      title: book.title_he,
      sku: book.sku,
      stockLocation: book.stock_location,
      isPurchasable: book.is_purchasable,
      isStockManaged: book.is_stock_managed ?? true,
      onHand,
      reserved,
      available: onHand - reserved,
      lowThreshold: book.low_stock_threshold,
    };
  });
}
