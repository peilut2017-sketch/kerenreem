import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/lib/supabase/types';
import type { ServiceRequestRow } from '@/lib/commerce/service-requests';

export interface PrintItem extends OrderItem {
  coverUrl: string | null;
  /** מיקום מדף נוכחי (books.stock_location) — לא מוצלם, תמיד עדכני */
  stockLocation: string | null;
}

export interface PrintOrderData {
  order: Order;
  items: PrintItem[];
}

interface BookLookup {
  coverUrl: string | null;
  stockLocation: string | null;
}

async function lookupBooks(supabase: SupabaseClient, bookIds: string[]): Promise<Map<string, BookLookup>> {
  const lookup = new Map<string, BookLookup>();
  if (bookIds.length === 0) return lookup;
  const { data: books } = await supabase
    .from('books')
    .select('id, cover_image_url, stock_location')
    .in('id', bookIds);
  for (const book of books ?? []) {
    lookup.set(book.id, { coverUrl: book.cover_image_url, stockLocation: book.stock_location });
  }
  return lookup;
}

function toPrintItems(items: OrderItem[], lookup: Map<string, BookLookup>): PrintItem[] {
  return items.map((item) => {
    const found = item.book_id ? lookup.get(item.book_id) : undefined;
    return { ...item, coverUrl: found?.coverUrl ?? null, stockLocation: found?.stockLocation ?? null };
  });
}

/** [1.5] שליפה משותפת לכל מסמכי ההדפסה — דרך ה-session client, תחת ה-RLS הרגיל. */
export async function getOrderForPrint(orderId: string): Promise<PrintOrderData | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return null;

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');

  const bookIds = [...new Set((items ?? []).map((item) => item.book_id).filter((id): id is string => Boolean(id)))];
  const lookup = await lookupBooks(supabase, bookIds);

  return { order: order as Order, items: toPrintItems((items ?? []) as OrderItem[], lookup) };
}

export async function getManyOrdersForPrint(orderIds: string[]): Promise<PrintOrderData[]> {
  const supabase = await createClient();
  if (!supabase || orderIds.length === 0) return [];

  const { data: orders } = await supabase.from('orders').select('*').in('id', orderIds);
  const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds).order('created_at');

  const bookIds = [...new Set((items ?? []).map((item) => item.book_id).filter((id): id is string => Boolean(id)))];
  const lookup = await lookupBooks(supabase, bookIds);
  const printItems = toPrintItems((items ?? []) as OrderItem[], lookup);

  const itemsByOrder = new Map<string, PrintItem[]>();
  for (const item of printItems) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  // שומר את סדר ה-ids שהתבקש (סדר הבחירה ברשימת ההזמנות), לא סדר שרירותי מה-DB
  const byId = new Map((orders ?? []).map((order) => [order.id, order as Order]));
  return orderIds
    .map((id) => byId.get(id))
    .filter((order): order is Order => Boolean(order))
    .map((order) => ({ order, items: itemsByOrder.get(order.id) ?? [] }));
}

export async function getServiceRequestForPrint(requestId: string): Promise<ServiceRequestRow | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data } = await supabase.from('service_requests').select('*').eq('id', requestId).maybeSingle();
  return (data as ServiceRequestRow) ?? null;
}

/**
 * [1.5] תור איסוף עצמי — הזמנות שממתינות. "מוכן מאז" הוא updated_at
 * כקירוב (אין timestamp ייעודי ל-ready_for_pickup) — מדויק מספיק להתרעת
 * "לא נאסף", לא לחישוב חשבונאי.
 */
export async function getPickupQueue(): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('fulfillment_type', 'pickup')
    .eq('fulfillment_state', 'ready_for_pickup')
    .order('updated_at');
  return (data ?? []) as Order[];
}
