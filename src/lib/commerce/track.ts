import 'server-only';
import type { Order, OrderItem } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { generateGuestToken, guestTokenMatches, hashGuestToken, normalizePhone } from './guest-token';
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
    | 'user_id'
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

/**
 * [1.6] "מצא את ההזמנה שלי" לאורח (ט.19, ביקורת ב.24: "אין מסך 'הזנת
 * מספר הזמנה + טלפון'"). הטוקן הגולמי לא משוחזר לעולם — רק ה-hash שלו
 * נשמר (guest-token.ts) — לכן מונפק טוקן *חדש*, באותו תוקף 90 יום כמו
 * ביצירת ההזמנה (checkout.ts). אי-התאמה או הזמנה שלא נמצאה — null אחיד,
 * בלי לגלות איזה מהשניים היה שגוי.
 */
export async function findAndReissueGuestToken(
  orderNumber: number,
  contact: string,
): Promise<string | null> {
  const service = createServiceClient();
  if (!service) return null;

  const { data: order } = await service
    .from('orders')
    .select('id, contact_email, contact_phone, guest_token_revoked')
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (!order || order.guest_token_revoked) return null;

  const trimmed = contact.trim();
  const matches = trimmed.includes('@')
    ? (order.contact_email ?? '').toLowerCase() === trimmed.toLowerCase()
    : Boolean(order.contact_phone) && order.contact_phone === normalizePhone(trimmed);
  if (!matches) return null;

  const { token, hash } = generateGuestToken();
  const guestExpiry = new Date();
  guestExpiry.setDate(guestExpiry.getDate() + 90);
  const { error } = await service
    .from('orders')
    .update({ guest_token_hash: hash, guest_token_expires_at: guestExpiry.toISOString(), guest_token_revoked: false })
    .eq('id', order.id);
  if (error) {
    console.error('[commerce:track] reissue token', error.message);
    return null;
  }
  return token;
}
