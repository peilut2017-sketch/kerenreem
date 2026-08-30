import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { Order, OrderItem } from '@/lib/supabase/types';
import { createServiceClient } from '@/lib/supabase/service';
import { generateGuestToken, guestTokenMatches, hashGuestToken, normalizePhone } from './guest-token';
import { getStoreSettings } from './settings';
import { customerStatusKey } from './orders';

function constantTimeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
}

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
    // [1.6] כתובת ומספר מעקב (ח.13) — כבר נשלפים ב-select('*') למטה, רק
    // חסרים מהטיפוס המצומצם; המרחב חסר בטבלה בלבד, לא בשאילתה
    | 'shipping_address'
    | 'tracking_company'
    | 'tracking_number'
    | 'tracking_url'
  >;
  items: Pick<OrderItem, 'title_snapshot' | 'quantity' | 'unit_price' | 'line_total'>[];
  statusKey: string;
  documentUrl: string | null;
}

/**
 * העמודות שהעמוד באמת מציג + עמודות האימות. לא select('*'): השורה
 * המלאה כוללת guest_token_hash, טלפון והערות פנימיות — העברתה כמות
 * שהיא לקומפוננטת העמוד היא prop אחד מהדלפה.
 */
const TRACKED_ORDER_COLUMNS =
  'id, order_number, state, payment_state, fulfillment_state, document_state, ' +
  'fulfillment_type, promised_delivery_date, shipping_method_name_snapshot, ' +
  'subtotal, shipping_total, discount_total, total, currency, is_gift, created_at, ' +
  'locale, user_id, shipping_address, tracking_company, tracking_number, tracking_url, ' +
  'guest_token_hash, guest_token_revoked, guest_token_expires_at';

export async function getTrackedOrder(token: string): Promise<TrackedOrder | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const service = createServiceClient();
  if (!service) return null;

  const { data } = await service
    .from('orders')
    .select(TRACKED_ORDER_COLUMNS)
    .eq('guest_token_hash', hashGuestToken(token))
    .maybeSingle();
  // ‏postgrest-js אינו מסיק טיפוס ממחרוזת select מורכבת בלי טיפוסי סכימה
  const order = data as unknown as
    | (TrackedOrder['order'] & {
        id: string;
        guest_token_hash: string;
        guest_token_revoked: boolean;
        guest_token_expires_at: string | null;
      })
    | null;

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
  // השוואה קבועת-זמן, כמו הטוקן עצמו: זהו נתיב אימות (מייל/טלפון מול
  // מספר הזמנה), ו-=== רגיל דולף מידע תזמון על אורך ההתאמה.
  const matches = trimmed.includes('@')
    ? constantTimeEquals((order.contact_email ?? '').toLowerCase(), trimmed.toLowerCase())
    : Boolean(order.contact_phone) && constantTimeEquals(order.contact_phone, normalizePhone(trimmed));
  if (!matches) return null;

  const { token, hash } = generateGuestToken();
  const settings = await getStoreSettings();
  const guestExpiry = new Date();
  guestExpiry.setDate(guestExpiry.getDate() + (settings.guest_link_ttl_days ?? 90));
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
