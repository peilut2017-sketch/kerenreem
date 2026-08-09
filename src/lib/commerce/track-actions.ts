'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { hashGuestToken, guestTokenMatches } from './guest-token';
import { openServiceRequest } from './service-requests';
import { allowRequest, ipBucket } from './rate-limit';
import { findAndReissueGuestToken } from './track';

/**
 * פעולות הלקוח מעמוד המעקב (פרק 13.1): בקשת ביטול. הבקשה אינה מבטלת
 * אוטומטית — היא נרשמת בציר הזמן, מתייגת את ההזמנה ומופיעה בתצוגת
 * "בקשות ביטול" של הצוות. הזיהוי בטוקן בלבד, כמו העמוד עצמו.
 */

export interface TrackActionResult {
  ok: boolean;
  error?: 'not_found' | 'not_eligible' | 'rate_limited' | 'server';
}

const CANCEL_ELIGIBLE_STATES = new Set(['pending', 'confirmed']);
const CANCEL_ELIGIBLE_FULFILLMENT = new Set(['unfulfilled', 'preparing']);

export async function requestCancelByToken(
  token: string,
  reason: string,
): Promise<TrackActionResult> {
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('cancel-request', headerList), 5, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }
  if (!token || token.length < 20 || token.length > 100) return { ok: false, error: 'not_found' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };

  const { data: order } = await service
    .from('orders')
    .select('id, state, fulfillment_state, guest_token_hash, guest_token_revoked, guest_token_expires_at, tags')
    .eq('guest_token_hash', hashGuestToken(token))
    .maybeSingle();

  if (
    !order ||
    order.guest_token_revoked ||
    (order.guest_token_expires_at && new Date(order.guest_token_expires_at) < new Date()) ||
    !guestTokenMatches(token, order.guest_token_hash)
  ) {
    return { ok: false, error: 'not_found' };
  }

  if (
    !CANCEL_ELIGIBLE_STATES.has(order.state) ||
    !CANCEL_ELIGIBLE_FULFILLMENT.has(order.fulfillment_state)
  ) {
    return { ok: false, error: 'not_eligible' };
  }

  const result = await openServiceRequest(service, {
    orderId: order.id,
    kind: 'cancel',
    reason: reason.trim().slice(0, 300),
    requestedBy: 'customer',
    actor: { type: 'customer' },
  });
  if (!result.ok) return { ok: false, error: 'server' };

  return { ok: true };
}

/**
 * [1.6] "מצא את ההזמנה שלי" (ט.19) — הגבלת קצב כפולה כמו sendLoginLink:
 * דלי IP כללי + דלי לפי מספר ההזמנה הספציפי, כדי שלא יהיה אפשר לנחש
 * פרטי קשר מול מספר הזמנה ידוע בכוח גס.
 */
export interface FindOrderResult {
  ok: boolean;
  token?: string;
  error?: 'not_found' | 'rate_limited' | 'invalid';
}

export async function findMyOrder(orderNumberRaw: string, contactRaw: string): Promise<FindOrderResult> {
  const orderNumber = Number(orderNumberRaw.trim());
  const contact = contactRaw.trim();
  if (!Number.isInteger(orderNumber) || orderNumber <= 0 || !contact) {
    return { ok: false, error: 'invalid' };
  }

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('order-find', headerList), 8, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }
  if (!(await allowRequest(`order-find:${orderNumber}`, 5, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }

  const token = await findAndReissueGuestToken(orderNumber, contact);
  if (!token) return { ok: false, error: 'not_found' };
  return { ok: true, token };
}
