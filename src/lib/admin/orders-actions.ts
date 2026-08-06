'use server';

import { revalidatePath } from 'next/cache';
import { assertRole } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  isTransitionAllowed,
  recordOrderEvent,
  transitionOrder,
  type StateAxis,
} from '@/lib/commerce/orders';
import { adjustStock } from '@/lib/commerce/inventory';
import { sendOrderEmail, type EmailTemplate } from '@/lib/commerce/notifications';
import { refundTransaction } from '@/lib/commerce/morning';
import type { Order } from '@/lib/supabase/types';

/**
 * פעולות הצוות על הזמנות ומלאי (פרקים 9–10 במסמך האב). הקריאות עוברות
 * דרך ה-RLS של הצוות היכן שקיים policy; פעולות כספיות (תשלום ידני,
 * זיכוי, תנועות מלאי) עוברות ל-service client רק אחרי assertRole,
 * ומתועדות ב-audit ובציר הזמן.
 */

export interface OrderActionResult {
  ok: boolean;
  error?: string;
}

const ORDERS_PATHS = ['/admin/orders'];

function revalidateOrders(orderId?: string) {
  for (const path of ORDERS_PATHS) revalidatePath(path);
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

/** מעבר מצב באחד מארבעת הצירים — רק מעברים חוקיים, עם תיעוד מלא. */
export async function staffTransitionOrder(
  orderId: string,
  axis: StateAxis,
  to: string,
): Promise<OrderActionResult> {
  const session = await assertRole('editor');
  if ('error' in session) return { ok: false, error: session.error };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  // "סימון תשלום חיצוני" וזיכויים אינם עוברים כאן — יש להם פעולות
  // ייעודיות עם הרשאות והגנות משלהן.
  if (axis === 'payment_state') {
    return { ok: false, error: 'שינוי מצב תשלום נעשה דרך הפעולות הייעודיות בלבד' };
  }

  const result = await transitionOrder(service, orderId, axis, to, {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  });
  if (!result.ok) return { ok: false, error: result.error };

  // הודעות אספקה ללקוח — מייל תמיד (פרק 15.3)
  if (axis === 'fulfillment_state' && result.order) {
    const template: EmailTemplate | null =
      to === 'shipped' ? 'shipped' : to === 'ready_for_pickup' ? 'ready_for_pickup' : null;
    if (template) await sendOrderEmail(service, template, result.order);
  }
  if (axis === 'state' && to === 'cancelled' && result.order) {
    await sendOrderEmail(service, 'cancelled', result.order);
  }

  revalidateOrders(orderId);
  return { ok: true };
}

/** הוספת מספר מעקב — נשמר בציר הזמן + מייל "נשלח" עם המעקב. */
export async function addTracking(
  orderId: string,
  input: { company: string; trackingNumber: string; trackingUrl?: string },
): Promise<OrderActionResult> {
  const session = await assertRole('editor');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  await recordOrderEvent(service, orderId, 'tracking_added', {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  }, {
    company: input.company,
    tracking_number: input.trackingNumber,
    tracking_url: input.trackingUrl ?? null,
  });

  const transition = await transitionOrder(service, orderId, 'fulfillment_state', 'shipped', {
    type: 'staff',
    id: session.userId,
  });
  if (transition.ok && transition.order) {
    await sendOrderEmail(service, 'shipped', transition.order, {
      trackingNumber: input.trackingNumber,
      trackingUrl: input.trackingUrl ?? null,
    });
  }
  revalidateOrders(orderId);
  return { ok: true };
}

/** הערה פנימית — נשמרת בציר הזמן (order_events), לא על ההזמנה. */
export async function addOrderNote(orderId: string, note: string): Promise<OrderActionResult> {
  const session = await assertRole('editor');
  if ('error' in session) return { ok: false, error: session.error };
  if (!note.trim()) return { ok: false, error: 'הערה ריקה' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };
  await recordOrderEvent(
    service,
    orderId,
    'note_added',
    { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
    { note: note.trim().slice(0, 1000) },
  );
  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * סימון תשלום חיצוני (ערוץ הטלפון — פרק 9.6): admin בלבד, מתועד כפול —
 * audit + ציר זמן. יוצר רשומת payment מסוג manual_external.
 */
export async function markManualPayment(orderId: string): Promise<OrderActionResult> {
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (!isTransitionAllowed('payment_state', order.payment_state, 'paid')) {
    return { ok: false, error: `לא ניתן לסמן תשלום ממצב ${order.payment_state}` };
  }

  const { error: paymentError } = await service.from('payments').insert({
    order_id: orderId,
    kind: 'charge',
    provider: 'manual',
    method: 'manual_external',
    amount: order.total,
    currency: order.currency,
    status: 'succeeded',
    idempotency_key: `order:${orderId}:manual`,
  });
  if (paymentError && paymentError.code !== '23505') {
    return { ok: false, error: paymentError.message };
  }

  await transitionOrder(service, orderId, 'payment_state', 'paid', {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  }, { manual: true });
  await transitionOrder(service, orderId, 'state', 'confirmed', {
    type: 'staff',
    id: session.userId,
  });

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'manual_payment',
      table_name: 'orders',
      record_id: orderId,
      context: 'סימון תשלום חיצוני',
    });
  }

  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * זיכוי דרך מורנינג (תרשים 15): admin בלבד, תקרת הזיכוי נאכפת גם במסד
 * (טריגר enforce_refund_cap). אישור כפול נעשה ב-UI; כאן ההגנה האחרונה.
 */
export async function refundOrder(
  orderId: string,
  amount: number,
  reason: string,
): Promise<OrderActionResult> {
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };
  if (!(amount > 0)) return { ok: false, error: 'סכום זיכוי לא תקין' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: charge } = await service
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .eq('kind', 'charge')
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!charge) return { ok: false, error: 'לא נמצא חיוב שהצליח לזכות' };

  const { data: refundRow, error: insertError } = await service
    .from('payments')
    .insert({
      order_id: orderId,
      kind: 'refund',
      parent_payment_id: charge.id,
      provider: charge.provider,
      method: charge.method,
      amount,
      currency: charge.currency,
      status: 'initiated',
      idempotency_key: `refund:${orderId}:${Date.now()}`,
    })
    .select('*')
    .maybeSingle();
  if (insertError || !refundRow) {
    return { ok: false, error: insertError?.message ?? 'יצירת הזיכוי נכשלה (חריגה מהתקרה?)' };
  }

  if (charge.provider === 'morning' && charge.morning_transaction_id) {
    const morningResult = await refundTransaction({
      transactionId: charge.morning_transaction_id,
      amount,
      reason,
    });
    if (!morningResult.ok) {
      await service
        .from('payments')
        .update({ status: 'failed', error: { message: morningResult.error } })
        .eq('id', refundRow.id);
      return { ok: false, error: `מורנינג דחתה את הזיכוי: ${morningResult.error}` };
    }
  }

  await service.from('payments').update({ status: 'succeeded' }).eq('id', refundRow.id);

  const { data: refunds } = await service
    .from('payments')
    .select('amount')
    .eq('parent_payment_id', charge.id)
    .eq('kind', 'refund')
    .eq('status', 'succeeded');
  const refunded = (refunds ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const fullyRefunded = refunded >= Number(charge.amount) - 0.01;

  const { data: orderRow } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (orderRow) {
    await transitionOrder(
      service,
      orderId,
      'payment_state',
      fullyRefunded ? 'refunded' : 'partially_refunded',
      { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
      { amount, reason },
    );
    await recordOrderEvent(service, orderId, 'refund_issued', {
      type: 'staff',
      id: session.userId,
    }, { amount, reason });
    await sendOrderEmail(service, 'refunded', orderRow as Order, { refundAmount: amount });
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'refund',
      table_name: 'orders',
      record_id: orderId,
      new_values: { amount, reason },
      context: 'זיכוי',
    });
  }

  revalidateOrders(orderId);
  return { ok: true };
}

/** שליחה חוזרת של מייל מהזמנה — עוקפת את ה-idempotency במפתח ייעודי. */
export async function resendOrderEmail(
  orderId: string,
  template: EmailTemplate,
): Promise<OrderActionResult> {
  const session = await assertRole('editor');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };

  // סיומת מפתח לפי הרגע — שליחה חוזרת מפורשת אינה "כפילות" לחסימה
  await sendOrderEmail(service, template, order as Order, {}, `resend:${Date.now()}`);
  await recordOrderEvent(service, orderId, 'email_sent', {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  }, { template, resend: true });
  revalidateOrders(orderId);
  return { ok: true };
}

/** תנועת מלאי ידנית ממסך המלאי — לעולם לא set ישיר (פרק 10). */
export async function staffAdjustStock(input: {
  bookId: string;
  delta: number;
  moveType: 'receive' | 'return_restock' | 'damage' | 'manual_adjust' | 'count';
  reason: string;
}): Promise<OrderActionResult & { onHand?: number }> {
  const session = await assertRole('editor');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const result = await adjustStock(service, {
    bookId: input.bookId,
    delta: input.delta,
    moveType: input.moveType,
    reason: input.reason,
    actorId: session.userId,
  });
  if (!result.ok) {
    const messages: Record<string, string> = {
      would_go_negative: 'התנועה הייתה מורידה את המלאי מתחת לאפס',
      below_reserved: 'התנועה הייתה מורידה את המלאי מתחת לכמות השמורה',
      invalid_move_type: 'סוג תנועה לא מוכר',
      zero_delta: 'כמות אפס',
    };
    return { ok: false, error: messages[result.reason] ?? result.reason };
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'stock_adjust',
      table_name: 'books',
      record_id: input.bookId,
      new_values: { delta: input.delta, move_type: input.moveType, reason: input.reason },
    });
  }
  revalidatePath('/admin/inventory');
  return { ok: true, onHand: result.onHand };
}
