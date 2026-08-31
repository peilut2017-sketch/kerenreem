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
  cancellationPath,
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
  /**
   * ‏true רק כשהקריאה הזו היא שביצעה בפועל את המעבר. ‏ok=true עם
   * changed=false פירושו "כבר היה ביעד" (אירוע כפול / מירוץ) — כך שנתיב
   * הצד (מייל ללקוח, הפחתת מלאי) נתלה ב-changed ולא ב-ok, ואינו נשלח
   * פעמיים כשה-Webhook וה-poll מעבדים את אותו תשלום במקביל.
   */
  changed?: boolean;
}

/**
 * מעבר מצב בציר יחיד: אימות חוקיות → עדכון → רישום בציר הזמן.
 * ציוני הזמן (paid_at, cancelled_at, completed_at) מתעדכנים לפי היעד.
 *
 * ‏guard: תנאי שוויון נוספים על ה-UPDATE (מעבר ל-eq על הציר עצמו). כך
 * מבטל-cron יכול לדרוש payment_state='pending' ולא לבטל בטעות הזמנה
 * ששולמה זה עתה (confirmed→cancelled חוקי ברמת המכונה — האכיפה לפי
 * תשלום נעשית כאן, אטומית, ולא בקריאה-ואז-כתיבה).
 */
export async function transitionOrder(
  service: SupabaseClient,
  orderId: string,
  axis: StateAxis,
  to: string,
  actor: Actor,
  eventData: Record<string, unknown> = {},
  guard: Record<string, string> = {},
): Promise<TransitionResult> {
  const { data: order, error: loadError } = await service
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle();

  if (loadError || !order) return { ok: false, error: loadError?.message ?? 'order not found' };

  // תנאי ה-guard מאומתים גם על הצילום הנקרא: אם כבר לא מתקיימים, אין
  // טעם לנסות — נחזיר "מירוץ" עקבי עם ענף ה-!updated למטה.
  for (const [col, val] of Object.entries(guard)) {
    if ((order[col] as string) !== val) return { ok: false, error: 'guard not met' };
  }

  const from = order[axis] as string;
  if (from === to) return { ok: true, order: order as Order, changed: false };
  if (!isTransitionAllowed(axis, from, to)) {
    return { ok: false, error: `illegal transition ${axis}: ${from} → ${to}` };
  }

  const patch: Record<string, unknown> = { [axis]: to };
  const nowIso = new Date().toISOString();
  if (axis === 'payment_state' && to === 'paid') patch.paid_at = nowIso;
  if (axis === 'state' && to === 'cancelled') patch.cancelled_at = nowIso;
  if (axis === 'state' && to === 'completed') patch.completed_at = nowIso;

  let query = service.from('orders').update(patch).eq('id', orderId).eq(axis, from);
  for (const [col, val] of Object.entries(guard)) query = query.eq(col, val);
  const { data: updated, error: updateError } = await query.select('*').maybeSingle();

  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) {
    // מישהו הקדים אותנו (או ש-guard נכשל בין הקריאה לכתיבה) — נקרא מחדש
    // ונכריע לפי המצב העדכני. changed=false: לא אנחנו שביצענו את המעבר.
    const { data: fresh } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
    if (fresh && fresh[axis] === to) return { ok: true, order: fresh as Order, changed: false };
    return { ok: false, error: 'concurrent state change' };
  }

  await recordOrderEvent(service, orderId, 'status_changed', actor, {
    axis,
    from,
    to,
    ...eventData,
  });
  return { ok: true, order: updated as Order, changed: true };
}
