import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/lib/supabase/types';
import type { ServiceRequestRow } from '@/lib/commerce/service-requests';

export interface PrintItem extends OrderItem {
  coverUrl: string | null;
}

export interface PrintOrderData {
  order: Order;
  items: PrintItem[];
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
  const covers = new Map<string, string | null>();
  if (bookIds.length > 0) {
    const { data: books } = await supabase.from('books').select('id, cover_image_url').in('id', bookIds);
    for (const book of books ?? []) covers.set(book.id, book.cover_image_url);
  }

  return {
    order: order as Order,
    items: (items ?? []).map((item) => ({
      ...item,
      coverUrl: item.book_id ? (covers.get(item.book_id) ?? null) : null,
    })) as PrintItem[],
  };
}

export async function getManyOrdersForPrint(orderIds: string[]): Promise<PrintOrderData[]> {
  const supabase = await createClient();
  if (!supabase || orderIds.length === 0) return [];

  const { data: orders } = await supabase.from('orders').select('*').in('id', orderIds);
  const { data: items } = await supabase.from('order_items').select('*').in('order_id', orderIds).order('created_at');

  const bookIds = [...new Set((items ?? []).map((item) => item.book_id).filter((id): id is string => Boolean(id)))];
  const covers = new Map<string, string | null>();
  if (bookIds.length > 0) {
    const { data: books } = await supabase.from('books').select('id, cover_image_url').in('id', bookIds);
    for (const book of books ?? []) covers.set(book.id, book.cover_image_url);
  }

  const itemsByOrder = new Map<string, PrintItem[]>();
  for (const item of items ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({ ...item, coverUrl: item.book_id ? (covers.get(item.book_id) ?? null) : null } as PrintItem);
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
