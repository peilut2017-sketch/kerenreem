import 'server-only';
import type { Order, OrderItem } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { guestTokenMatches, hashGuestToken } from './guest-token';
import { customerStatusKey } from './orders';

/**
 * עמוד המעקב לאורח (פרק 16.1): זיהוי בטוקן בלבד, בצד השרת בלבד —
 * אין RLS ללקוח על orders דרך הנתיב הזה. טוקן לא תקף מחזיר null אחיד:
 * 404 גנרי, בלי לאשר שההזמנה קיימת.
 */

export interface TrackedOrder {
  order: Pick<
    Order,
    | 'order_number'
    | 'state'
    | 'payment_state'
    | 'fulfillment_state'
    | 'document_state'
    | 'fulfillment_type'
    | 'promised_delivery_date'
    | 'shipping_method_name_snapshot'
    | 'subtotal'
    | 'shipping_total'
    | 'discount_total'
    | 'total'
    | 'currency'
    | 'is_gift'
    | 'created_at'
    | 'locale'
  >;
  items: Pick<OrderItem, 'title_snapshot' | 'quantity' | 'unit_price' | 'line_total'>[];
  statusKey: string;
  documentUrl: string | null;
}

export async function getTrackedOrder(token: string): Promise<TrackedOrder | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const service = createServiceClient();
  if (!service) return null;

  const { data: order } = await service
    .from('orders')
    .select('*')
    .eq('guest_token_hash', hashGuestToken(token))
    .maybeSingle();

  if (
    !order ||
    order.guest_token_revoked ||
    (order.guest_token_expires_at && new Date(order.guest_token_expires_at) < new Date()) ||
    !guestTokenMatches(token, order.guest_token_hash)
  ) {
    return null;
  }

  const [{ data: items }, { data: doc }] = await Promise.all([
    service
      .from('order_items')
      .select('title_snapshot, quantity, unit_price, line_total')
      .eq('order_id', order.id),
    service
      .from('documents')
      .select('download_url, url_expires_at')
      .eq('order_id', order.id)
      .eq('status', 'created')
      .limit(1)
      .maybeSingle(),
  ]);

  const documentUrl =
    doc?.download_url && (!doc.url_expires_at || new Date(doc.url_expires_at) > new Date())
      ? doc.download_url
      : null;

  return {
    order: order as TrackedOrder['order'],
    items: (items ?? []) as TrackedOrder['items'],
    statusKey: customerStatusKey(order),
    documentUrl,
  };
}
