'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  cancellationPath,
  isTransitionAllowed,
  recordOrderEvent,
  transitionOrder,
  type StateAxis,
} from '@/lib/commerce/orders';
import { adjustStock, releaseStock, transferStock } from '@/lib/commerce/inventory';
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
  // ציר האספקה פתוח גם למלקט; ציר ההזמנה — למנהלי חנות בלבד
  const session = await assertPermission(axis === 'fulfillment_state' ? 'store_view' : 'store');
  if ('error' in session) return { ok: false, error: session.error };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  // "סימון תשלום חיצוני" וזיכויים אינם עוברים כאן — יש להם פעולות
  // ייעודיות עם הרשאות והגנות משלהן.
  if (axis === 'payment_state') {
    return { ok: false, error: 'שינוי מצב תשלום נעשה דרך הפעולות הייעודיות בלבד' };
  }
  // [1.1] ביטול אינו מעבר מצב רגיל — יש לו זרימה משלו (cancelOrder):
  // הזמנה ששולמה חייבת זיכוי מלא לפני cancelled (תרשים 13).
  if (axis === 'state' && (to === 'cancelled' || to === 'cancel_pending_refund')) {
    return { ok: false, error: 'ביטול הזמנה נעשה דרך פעולת הביטול הייעודית' };
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

  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * [1.1] ביטול הזמנה — תרשים 13 המתוקן:
 * לא שולמה ⇒ cancelled מיידי + שחרור שמירות; שולמה ⇒ cancel_pending_refund,
 * וה-cancelled נרשם רק כשהזיכוי המלא מצליח (refundOrder משלים אותו).
 * פריטים שלא נשלחו חוזרים למלאי מיידית; פריטים שנשלחו — רק אחרי חזרה
 * פיזית (תנועת return_restock נפרדת ממסך המלאי).
 */
export async function cancelOrder(orderId: string, reason: string): Promise<OrderActionResult> {
  const session = await assertPermission('store');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };

  const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
  const path = cancellationPath(order.payment_state);

  if (path === 'refund_first') {
    // שולמה: נכנסים למצב ביניים; הזיכוי המלא (refundOrder) ישלים ל-cancelled
    const result = await transitionOrder(service, orderId, 'state', 'cancel_pending_refund', actor, {
      reason,
    });
    if (!result.ok) return { ok: false, error: result.error };
    await recordOrderEvent(service, orderId, 'cancel_approved', actor, { reason, awaiting: 'refund' });
    revalidateOrders(orderId);
    return { ok: true };
  }

  // לא שולמה (או שכבר זוכתה במלואה): ביטול מיידי + טיפול מלאי לפי המצב
  const result = await transitionOrder(service, orderId, 'state', 'cancelled', actor, { reason });
  if (!result.ok) return { ok: false, error: result.error };

  const wasCommitted = path === 'already_refunded'; // המלאי הופחת בתשלום שקדם לזיכוי
  const notShipped = !['shipped', 'delivered', 'fulfilled', 'returned'].includes(
    order.fulfillment_state,
  );
  const { data: items } = await service
    .from('order_items')
    .select('book_id, quantity')
    .eq('order_id', orderId);
  for (const item of items ?? []) {
    if (!item.book_id) continue;
    if (wasCommitted) {
      if (notShipped) {
        await adjustStock(service, {
          bookId: item.book_id,
          delta: item.quantity,
          moveType: 'cancel_restock',
          reason: 'ביטול הזמנה שזוכתה — הפריטים לא נשלחו',
          orderId,
          actorId: session.userId,
        });
      }
    } else {
      await releaseStock(service, item.book_id, item.quantity, orderId);
    }
  }

  if (result.order) await sendOrderEmail(service, 'cancelled', result.order);
  revalidateOrders(orderId);
  return { ok: true };
}

/** הוספת מספר מעקב — נשמר בציר הזמן + מייל "נשלח" עם המעקב. */
export async function addTracking(
  orderId: string,
  input: { company: string; trackingNumber: string; trackingUrl?: string },
): Promise<OrderActionResult> {
  const session = await assertPermission('store_view');
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
  const session = await assertPermission('store_view');
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
  const session = await assertPermission('finance');
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
  const session = await assertPermission('finance');
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
    const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
    await transitionOrder(
      service,
      orderId,
      'payment_state',
      fullyRefunded ? 'refunded' : 'partially_refunded',
      actor,
      { amount, reason },
    );
    await recordOrderEvent(service, orderId, 'refund_issued', actor, { amount, reason });
    await sendOrderEmail(service, 'refunded', orderRow as Order, { refundAmount: amount });

    // [1.1] השלמת ביטול שהמתין לזיכוי (תרשים 13): רק זיכוי *מלא* מעביר
    // ל-cancelled. פריטים שלא נשלחו משוחררים מהשמירה מיידית; פריטים
    // שנשלחו יחזרו למלאי רק בקבלה פיזית (return_restock ממסך המלאי).
    if (fullyRefunded && orderRow.state === 'cancel_pending_refund') {
      const done = await transitionOrder(service, orderId, 'state', 'cancelled', actor, {
        refund_completed: true,
      });
      if (done.ok) {
        // המלאי כבר הופחת בתשלום (commit) — לכן ההחזרה היא תנועת
        // cancel_restock, ורק לפריטים שלא יצאו מהמחסן. מה שנשלח יחזור
        // בתנועת return_restock בקבלה פיזית.
        const notShipped = !['shipped', 'delivered', 'fulfilled', 'returned'].includes(
          orderRow.fulfillment_state,
        );
        if (notShipped) {
          const { data: items } = await service
            .from('order_items')
            .select('book_id, quantity')
            .eq('order_id', orderId);
          for (const item of items ?? []) {
            if (!item.book_id) continue;
            await adjustStock(service, {
              bookId: item.book_id,
              delta: item.quantity,
              moveType: 'cancel_restock',
              reason: 'ביטול לאחר זיכוי מלא — הפריטים לא נשלחו',
              orderId,
              actorId: session.userId,
            });
          }
        }
        if (done.order) await sendOrderEmail(service, 'cancelled', done.order);
      }
    } else if (!fullyRefunded && orderRow.state === 'cancel_pending_refund') {
      // זיכוי חלקי אינו מבטל — ההזמנה נשארת בהמתנה, עם תיעוד מפורש
      await recordOrderEvent(service, orderId, 'cancel_still_pending', actor, {
        refunded_so_far: refunded,
        charge_amount: Number(charge.amount),
      });
    }
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
  const session = await assertPermission('store');
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
  /** [1.1] מיקום מפורש (ריבוי מחסנים); ריק = המיקום הראשי */
  locationId?: string | null;
}): Promise<OrderActionResult & { onHand?: number }> {
  const session = await assertPermission('store');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const result = await adjustStock(service, {
    bookId: input.bookId,
    delta: input.delta,
    moveType: input.moveType,
    reason: input.reason,
    actorId: session.userId,
    locationId: input.locationId ?? null,
  });
  if (!result.ok) {
    const messages: Record<string, string> = {
      would_go_negative: 'התנועה הייתה מורידה את המלאי מתחת לאפס',
      below_reserved: 'התנועה הייתה מורידה את המלאי מתחת לכמות השמורה',
      invalid_move_type: 'סוג תנועה לא מוכר',
      zero_delta: 'כמות אפס',
      no_location: 'לא הוגדר מיקום מלאי ראשי — יש להגדיר מחסן בהגדרות המלאי',
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

/** [1.1] העברת מלאי בין מחסנים — תנועה כפולה אטומית (transfer_out/in). */
export async function staffTransferStock(input: {
  bookId: string;
  fromLocationId: string;
  toLocationId: string;
  qty: number;
  note?: string;
}): Promise<OrderActionResult> {
  const session = await assertPermission('store');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const result = await transferStock(service, {
    bookId: input.bookId,
    fromLocationId: input.fromLocationId,
    toLocationId: input.toLocationId,
    qty: input.qty,
    actorId: session.userId,
    note: input.note,
  });
  if (!result.ok) {
    const messages: Record<string, string> = {
      invalid_qty: 'כמות לא תקינה',
      same_location: 'מיקום המקור והיעד זהים',
      insufficient_at_source: 'אין מספיק מלאי פנוי במיקום המקור',
    };
    return { ok: false, error: messages[result.reason] ?? result.reason };
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'stock_transfer',
      table_name: 'books',
      record_id: input.bookId,
      new_values: { from: input.fromLocationId, to: input.toLocationId, qty: input.qty },
    });
  }
  revalidatePath('/admin/inventory');
  return { ok: true };
}

/** [1.1] הוספת מיקום מלאי (מחסן/נקודת איסוף) — מנהלי חנות. */
export async function createStockLocation(input: {
  name: string;
  kind: 'warehouse' | 'office' | 'pickup_point' | 'distributor' | 'temp';
}): Promise<OrderActionResult> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: 'שם ריק' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const slug = `loc-${Date.now().toString(36)}`;
  const { error } = await service.from('stock_locations').insert({
    slug,
    name,
    kind: input.kind,
    active: true,
    sort_order: 100,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/inventory');
  return { ok: true };
}

/** [1.1] עלות משלוח בפועל להזמנה — מזינה את דוח פער המשלוח (17.14). */
export async function setActualShippingCost(
  orderId: string,
  cost: number | null,
): Promise<OrderActionResult> {
  const session = await assertPermission('finance');
  if ('error' in session) return { ok: false, error: session.error };
  if (cost != null && !(cost >= 0)) return { ok: false, error: 'עלות לא תקינה' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { error } = await service
    .from('orders')
    .update({ actual_shipping_cost: cost })
    .eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  await recordOrderEvent(
    service,
    orderId,
    'actual_shipping_cost_set',
    { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
    { cost },
  );
  revalidateOrders(orderId);
  return { ok: true };
}
