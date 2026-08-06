import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActorType, Order } from '@/lib/supabase/types';
import { isTransitionAllowed, type StateAxis } from './state-machines';

/**
 * פעולות ההזמנה בצד השרת: מעבר מצב מאומת + רישום בציר הזמן.
 * מכונות המצבים עצמן — ב-state-machines.ts (טהור, נבדק בסקריפט).
 */

export {
  ORDER_STATE_TRANSITIONS,
  PAYMENT_STATE_TRANSITIONS,
  FULFILLMENT_STATE_TRANSITIONS,
  DOCUMENT_STATE_TRANSITIONS,
  isTransitionAllowed,
  customerStatusKey,
  type StateAxis,
} from './state-machines';

export interface Actor {
  type: ActorType;
  id?: string | null;
  label?: string | null;
}

export const SYSTEM_ACTOR: Actor = { type: 'system' };
export const MORNING_ACTOR: Actor = { type: 'morning' };

/** רישום אירוע בציר הזמן. best-effort ביחס לזרימה שכבר הצליחה במסד. */
export async function recordOrderEvent(
  service: SupabaseClient,
  orderId: string,
  eventType: string,
  actor: Actor,
  data: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await service.from('order_events').insert({
    order_id: orderId,
    event_type: eventType,
    data,
    actor_type: actor.type,
    actor_id: actor.id ?? null,
    actor_label: actor.label ?? null,
  });
  if (error) console.error('[commerce:order-event]', eventType, error.message);
}

export interface TransitionResult {
  ok: boolean;
  error?: string;
  order?: Order;
}

/**
 * מעבר מצב בציר יחיד: אימות חוקיות → עדכון → רישום בציר הזמן.
 * ציוני הזמן (paid_at, cancelled_at, completed_at) מתעדכנים לפי היעד.
 */
export async function transitionOrder(
  service: SupabaseClient,
  orderId: string,
  axis: StateAxis,
  to: string,
  actor: Actor,
  eventData: Record<string, unknown> = {},
): Promise<TransitionResult> {
  const { data: order, error: loadError } = await service
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (loadError || !order) return { ok: false, error: loadError?.message ?? 'order not found' };

  const from = order[axis] as string;
  if (from === to) return { ok: true, order: order as Order };
  if (!isTransitionAllowed(axis, from, to)) {
    return { ok: false, error: `illegal transition ${axis}: ${from} → ${to}` };
  }

  const patch: Record<string, unknown> = { [axis]: to };
  const nowIso = new Date().toISOString();
  if (axis === 'payment_state' && to === 'paid') patch.paid_at = nowIso;
  if (axis === 'state' && to === 'cancelled') patch.cancelled_at = nowIso;
  if (axis === 'state' && to === 'completed') patch.completed_at = nowIso;

  const { data: updated, error: updateError } = await service
    .from('orders')
    .update(patch)
    .eq('id', orderId)
    .eq(axis, from)
    .select('*')
    .maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    // מישהו הקדים אותנו — נקרא מחדש ונכריע לפי המצב העדכני
    const { data: fresh } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (fresh && fresh[axis] === to) return { ok: true, order: fresh as Order };
    return { ok: false, error: 'concurrent state change' };
  }

  await recordOrderEvent(service, orderId, 'status_changed', actor, {
    axis,
    from,
    to,
    ...eventData,
  });
  return { ok: true, order: updated as Order };
}
