'use server';

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

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
]);

function dailyVisitorHash(ip: string, userAgent: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? 'keren-raam-page-views';
  return createHash('sha256').update(`${today}:${ip}:${userAgent}:${salt}`).digest('hex');
}

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

    const supabase = await createClient();
    if (!supabase) return;

    const headerList = await headers();
    const ip =
      headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerList.get('x-real-ip') ||
      'unknown';
    const userAgent = headerList.get('user-agent') ?? 'unknown';

    const { error } = await supabase.from('commerce_events').insert({
      event_name: eventName,
      book_id: input.bookId ?? null,
      order_id: input.orderId ?? null,
      value_agorot: input.valueAgorot ?? null,
      meta: input.meta ?? {},
      session_key: input.sessionKey,
      visitor_hash: dailyVisitorHash(ip, userAgent),
      locale: input.locale ?? 'he',
    });
    // 23505 = כפל אירוע באותו session — מניעת הכפלה מכוונת, לא שגיאה
    if (error && error.code !== '23505') {
      console.error('[commerce:event]', eventName, error.message);
    }
  } catch (error) {
    console.error('[commerce:event] חריגה לא צפויה', error);
  }
}
