'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { allowRequest, ipBucket } from './rate-limit';
import { clientIp, dailyVisitorHash, isUuid } from '@/lib/analytics/shared';

/**
 * אירועי המסחר הראשוניים (פרק 24 במסמך האב) — באותה תבנית מוכחת של
 * page_views: ‏Server Action, ‏same-origin, ‏RLS של הוספה חופשית, גיבוב
 * מבקר יומי. בלי PII: מזהי ספר/הזמנה בלבד, לעולם לא טלפון/כתובת/שם.
 * GA4 נשאר משני וכפוף להסכמה; אירועי ecommerce אליו — רק אחרי עדכון
 * מדיניות הפרטיות (פער מתועד בניתוח הפערים).
 */

const ALLOWED_EVENTS = new Set([
  'product_viewed',
  'product_saved',
  'product_added_to_cart',
  'cart_viewed',
  'cart_updated',
  'free_shipping_progress_shown',
  'checkout_started',
  'express_checkout_used',
  'contact_submitted',
  'shipping_selected',
  'pickup_selected',
  'coupon_applied',
  'gift_selected',
  'gift_message_added',
  'donation_added',
  'installments_selected',
  'payment_method_selected',
  'notification_channel_optin',
  'phone_order_clicked',
  'payment_started',
  'payment_failed',
  'order_completed',
  'post_purchase_offer_accepted',
  'account_created_post_purchase',
  'order_cancel_requested',
  'return_requested',
  'back_in_stock_subscribed',
  'external_supplier_clicked',
]);

export async function recordCommerceEvent(
  eventName: string,
  input: {
    sessionKey: string;
    bookId?: string;
    orderId?: string;
    valueAgorot?: number;
    meta?: Record<string, string | number | boolean>;
    locale?: string;
  },
): Promise<void> {
  try {
    if (!ALLOWED_EVENTS.has(eventName)) return;
    if (!input.sessionKey || input.sessionKey.length > 64) return;

    const headerList = await headers();
    const ip = clientIp(headerList);
    // הגבלת קצב נדיבה: פעולה ציבורית לא מאומתת שמזינה את דוחות המרצ'נדייז
    // ("איזה ספר להדפיס מחדש"). בלי זה אפשר לנפח את מוני הצפייה/שמירה של
    // כל ספר בלולאה. הסף גבוה דיו כדי לא לפגוע בגלישה אמיתית; fail-open.
    if (!(await allowRequest(ipBucket('commerce-event', headerList), 240, 60))) return;

    const supabase = await createClient();
    if (!supabase) return;

    const userAgent = headerList.get('user-agent') ?? 'unknown';

    const { error } = await supabase.from('commerce_events').insert({
      event_name: eventName,
      // רק UUID תקין נכתב — book_id/order_id מגיעים מהלקוח, וזבל היה
      // נכתב לשורה ומזהם את הדוחות (ה-FK לא בהכרח קיים על כל העמודות).
      book_id: isUuid(input.bookId) ? input.bookId : null,
      order_id: isUuid(input.orderId) ? input.orderId : null,
      value_agorot:
        typeof input.valueAgorot === 'number' && Number.isFinite(input.valueAgorot) && input.valueAgorot >= 0
          ? Math.round(input.valueAgorot)
          : null,
      meta: sanitizeMeta(input.meta),
      session_key: input.sessionKey,
      visitor_hash: dailyVisitorHash(ip, userAgent),
      locale: input.locale === 'en' ? 'en' : 'he',
    });
    // 23505 = כפל אירוע באותו session — מניעת הכפלה מכוונת, לא שגיאה
    if (error && error.code !== '23505') {
      console.error('[commerce:event]', eventName, error.message);
    }
  } catch (error) {
    console.error('[commerce:event] חריגה לא צפויה', error);
  }
}

/**
 * תוחם את meta שמגיע מהלקוח: עד 10 מפתחות, ערכים פרימיטיביים בלבד,
 * מחרוזות עד 200 תווים — כדי שלא ניתן יהיה לתחוב jsonb כבד לטבלה.
 */
function sanitizeMeta(
  meta: Record<string, string | number | boolean> | undefined,
): Record<string, string | number | boolean> {
  if (!meta || typeof meta !== 'object') return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(meta).slice(0, 10)) {
    if (typeof value === 'string') out[key.slice(0, 60)] = value.slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key.slice(0, 60)] = value;
    else if (typeof value === 'boolean') out[key.slice(0, 60)] = value;
  }
  return out;
}
