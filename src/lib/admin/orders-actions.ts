'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission, assertScreenPermission } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import {
  cancellationPath,
  recordOrderEvent,
  transitionOrder,
  type StateAxis,
} from '@/lib/commerce/orders';
import {
  adjustReservation,
  adjustStock,
  commitStock,
  releaseStock,
  transferStock,
  uncommitStock,
} from '@/lib/commerce/inventory';
import { recordCreditNote } from '@/lib/commerce/documents';
import {
  openServiceRequest,
  resolveOpenCancelRequests,
  resolveServiceRequest,
} from '@/lib/commerce/service-requests';
import { sendOrderEmail, type EmailTemplate } from '@/lib/commerce/notifications';
import { refundTransaction } from '@/lib/commerce/morning';
import {
  createManualOrder,
  previewManualOrderTotals,
  type ManualOrderFulfillment,
  type ManualOrderItemInput,
  type ManualOrderPreview,
} from '@/lib/commerce/manual-orders';
import { startPayment } from '@/lib/commerce/payments';
import { formatPromisedDate } from '@/lib/commerce/delivery-date';
import { getStoreSettings } from '@/lib/commerce/settings';
import { round2 } from '@/lib/commerce/pricing';
import type { Order, ShippingAddress } from '@/lib/supabase/types';

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


/**
 * שער כפול לפעולות הכספיות על הזמנות: הרשאת finance (הדו-ממדית) *וגם*
 * עריכה במסך ההזמנות הגרגרי. בלי החלק השני, לוח ההרשאות פר-מסך הציג
 * הגבלה שלא סיפק: store_manager שהוסרה ממנו עריכת הזמנות ב-override
 * עדיין יכול היה לזכות ולמחוק הזמנות דרך finance הישן.
 */
async function assertFinanceOnOrders() {
  const result = await assertPermission('finance');
  if ('error' in result) return result;
  return assertScreenPermission('orders', 'edit');
}

/** מעבר מצב באחד מארבעת הצירים — רק מעברים חוקיים, עם תיעוד מלא. */
export async function staffTransitionOrder(
  orderId: string,
  axis: StateAxis,
  to: string,
): Promise<OrderActionResult> {
  // ציר האספקה פתוח גם למלקט; ציר ההזמנה — למנהלי חנות בלבד
  const session = await assertScreenPermission('orders', axis === 'fulfillment_state' ? 'view' : 'edit');
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
  const session = await assertScreenPermission('orders', 'edit');
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
    // [1.5] הביטול אושר וכעת בטיפול — בקשת השירות (אם הייתה) והתג הישן
    // כבר לא אמורים להישאר ב״ממתין״; זה בדיוק הבאג שבו התג לא מתנקה
    await resolveOpenCancelRequests(service, orderId, session.userId);
    revalidateOrders(orderId);
    return { ok: true };
  }

  // לא שולמה (או שכבר זוכתה במלואה): ביטול מיידי + טיפול מלאי לפי המצב
  const result = await transitionOrder(service, orderId, 'state', 'cancelled', actor, { reason });
  if (!result.ok) return { ok: false, error: result.error };
  await resolveOpenCancelRequests(service, orderId, session.userId);

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

/**
 * [1.5] בקשת החזרה שהצוות פותח (טלפון/מייל — אין עדיין ערוץ עצמי ללקוח).
 * לא מזכה ולא נוגעת במלאי בעצמה — רק פותחת את הבקשה; הזיכוי בפועל
 * (אם מאושר) עדיין דרך refundOrder הרגיל, לאחר שהפריטים חזרו פיזית.
 */
export async function openReturnRequest(
  orderId: string,
  reason: string,
  items: { bookId: string; title: string; quantity: number }[],
): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  if (!reason.trim()) return { ok: false, error: 'נדרשת סיבה' };
  if (items.length === 0) return { ok: false, error: 'יש לבחור לפחות פריט אחד להחזרה' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const result = await openServiceRequest(service, {
    orderId,
    kind: 'return',
    reason,
    requestedBy: 'staff',
    items,
    actor: { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidateOrders(orderId);
  return { ok: true };
}

/** [1.5] סגירת בקשת שירות (ביטול/החזרה) בלי לבטל את ההזמנה — למשל הלקוח חזר בו. */
export async function closeServiceRequest(
  requestId: string,
  status: 'resolved' | 'declined',
  note: string,
): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const result = await resolveServiceRequest(service, requestId, status, note, session.userId);
  if (!result.ok) return { ok: false, error: result.error };
  if (result.orderId) revalidateOrders(result.orderId);
  return { ok: true };
}

/**
 * הוספת מספר מעקב — נשמר על ההזמנה עצמה (לא רק בציר הזמן, כדי שיהיה
 * ניתן להציג ולחפש), ורק *אחרי* מעבר מוצלח ל-shipped נרשם האירוע
 * ונשלח המייל. [1.4] לפני התיקון הפונקציה החזירה {ok:true} גם כשהמעבר
 * נכשל (למשל הזמנה שכבר נשלחה) — הצוות ראה "בוצע" בזמן שדבר לא קרה.
 */
export async function addTracking(
  orderId: string,
  input: { company: string; trackingNumber: string; trackingUrl?: string },
): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'view');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const transition = await transitionOrder(service, orderId, 'fulfillment_state', 'shipped', {
    type: 'staff',
    id: session.userId,
  });
  if (!transition.ok || !transition.order) {
    return { ok: false, error: transition.error ?? 'לא ניתן לסמן את ההזמנה כנשלחה מהמצב הנוכחי' };
  }

  await service
    .from('orders')
    .update({
      tracking_company: input.company.trim().slice(0, 80) || null,
      tracking_number: input.trackingNumber.trim().slice(0, 80),
      tracking_url: input.trackingUrl?.trim().slice(0, 500) || null,
    })
    .eq('id', orderId);

  await recordOrderEvent(service, orderId, 'tracking_added', {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  }, {
    company: input.company,
    tracking_number: input.trackingNumber,
    tracking_url: input.trackingUrl ?? null,
  });

  // [1.3] פירוט מה שנשלח בפועל: אם סומן ליקוט חלקי — לפי picked_quantity
  const { data: shippedItems } = await service
    .from('order_items')
    .select('title_snapshot, quantity, picked_quantity, line_total, unit_price')
    .eq('order_id', orderId);
  const anyPicked = (shippedItems ?? []).some((item) => item.picked_quantity != null);
  const itemsForEmail = (shippedItems ?? [])
    .map((item) => ({
      title: item.title_snapshot ?? '',
      quantity: anyPicked ? (item.picked_quantity ?? 0) : item.quantity,
      lineTotal: Number(item.line_total ?? Number(item.unit_price) * item.quantity),
    }))
    .filter((item) => item.quantity > 0);
  await sendOrderEmail(service, 'shipped', transition.order, {
    trackingNumber: input.trackingNumber,
    trackingUrl: input.trackingUrl ?? null,
    items: itemsForEmail,
  });

  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * [1.5] ביטול סימון "נשלח" שבוצע בטעות (הזמנה/שליח לא נכונים): מחזיר את
 * ההזמנה למצב "בהכנה" ומנקה את פרטי המעקב. לא נוגע במלאי — הכנת מלאי
 * קורית בתשלום, לא במשלוח — ולכן בטוח גם אם ההזמנה שולמה. המייל "נשלח"
 * שכבר יצא ללקוח אינו ניתן לביטול; זו הגבלה מוצגת ב-UI, לא כאן.
 */
export async function undoShipment(orderId: string, reason: string): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'view');
  if ('error' in session) return { ok: false, error: session.error };
  if (!reason.trim()) return { ok: false, error: 'נדרשת סיבה — נשמרת בציר הזמן' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (order.fulfillment_state !== 'shipped') {
    return { ok: false, error: 'ניתן לבטל רק הזמנה שסומנה כ״נשלחה״ ועדיין לא נמסרה' };
  }

  const { data: updated, error: updateError } = await service
    .from('orders')
    .update({
      fulfillment_state: 'preparing',
      tracking_company: null,
      tracking_number: null,
      tracking_url: null,
    })
    .eq('id', orderId)
    .eq('fulfillment_state', 'shipped')
    .select('*')
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: 'המצב השתנה בינתיים — רעננו ונסו שוב' };

  const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
  await recordOrderEvent(service, orderId, 'status_changed', actor, {
    axis: 'fulfillment_state',
    from: 'shipped',
    to: 'preparing',
    undo: true,
    reason,
  });

  revalidateOrders(orderId);
  return { ok: true };
}

/** הערה פנימית — נשמרת בציר הזמן (order_events), לא על ההזמנה. */
export async function addOrderNote(orderId: string, note: string): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'view');
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
  const session = await assertFinanceOnOrders();
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  // בדיקה מפורשת ולא isTransitionAllowed: המכונה מתירה מעבר "עצמי"
  // (paid→paid מחזיר true), כך שהזמנה שכבר שולמה דרך מורנינג הייתה
  // עוברת את השער ומקבלת רשומת חיוב *שנייה* על מלוא הסכום — הכנסה
  // כפולה בדוחות ותקרת זיכוי כפולה (enforce_refund_cap היא פר-חיוב).
  // אותו תנאי בדיוק כמו startAdminCardPayment ו-startPayment.
  if (!['pending', 'failed'].includes(order.payment_state)) {
    return { ok: false, error: `ההזמנה כבר במצב ${order.payment_state} — אין מה לסמן` };
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

  // [1.4] תשלום ידני חייב לעבור את אותו נתיב מלאי כמו תשלום מקוון —
  // אחרת reserved לעולם לא משתחרר ו-on_hand לא יורד, וביטול מאוחר יותר
  // מוסיף למלאי עותקים שמעולם לא הופחתו ממנו (ניפוח מלאי). אידמפוטנטי
  // כמו commitStock בנתיב ה-Webhook — לא יזיק אם ירוץ פעמיים.
  const { data: manualItems } = await service
    .from('order_items')
    .select('book_id, quantity, is_preorder')
    .eq('order_id', orderId);
  for (const item of manualItems ?? []) {
    if (!item.book_id || item.is_preorder) continue;
    await commitStock(service, item.book_id, item.quantity, orderId);
  }
  await transitionOrder(service, orderId, 'document_state', 'pending', {
    type: 'staff',
    id: session.userId,
  });

  const promisedLabel = order.promised_delivery_date
    ? formatPromisedDate(new Date(order.promised_delivery_date), order.locale)
    : null;
  await sendOrderEmail(service, 'payment_received', { ...order, payment_state: 'paid' } as Order, {
    promisedDateLabel: promisedLabel,
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
 * [1.5] ביטול סימון תשלום ידני שבוצע בטעות — היפוך סימטרי ל-markManualPayment:
 * מבטל את רשומת התשלום הידני, משחרר את המלאי חזרה ל״שמור״ (commerce_uncommit_stock,
 * לא release — ההזמנה עדיין פעילה) ומחזיר את שלושת הצירים. שני הצירים
 * (payment_state: paid→pending, state: confirmed→pending) אינם מעברים
 * חוקיים במכונת המצבים הרגילה בכוונה — זו תיקון-בדיעבד ייעודי, לא זרימה
 * כללית, ולכן עוקף את transitionOrder ומתעד ידנית.
 *
 * מותר רק כשעדיין לא נשלח דבר וטרם הופק מסמך חשבונאי — אחרת יש לפעול
 * דרך זיכוי (refundOrder), לא ביטול-בדיעבד של הסימון.
 */
export async function undoManualPayment(orderId: string, reason: string): Promise<OrderActionResult> {
  const session = await assertFinanceOnOrders();
  if ('error' in session) return { ok: false, error: session.error };
  if (!reason.trim()) return { ok: false, error: 'נדרשת סיבה — נשמרת בציר הזמן' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };

  const { data: payment } = await service
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('provider', 'manual')
    .eq('status', 'succeeded')
    .maybeSingle();
  if (!payment) {
    return { ok: false, error: 'לא נמצא תשלום ידני לביטול — תשלום דרך מורנינג מבוטל בזיכוי' };
  }
  if (order.payment_state !== 'paid' || order.state !== 'confirmed') {
    return { ok: false, error: 'ההזמנה כבר התקדמה למצב אחר — רעננו ובדקו' };
  }
  if (order.fulfillment_state !== 'unfulfilled') {
    return { ok: false, error: 'ההזמנה כבר בהכנה/נשלחה — לביטול תשלום יש להשתמש בזיכוי' };
  }
  if (!['not_created', 'pending'].includes(order.document_state)) {
    return { ok: false, error: 'כבר הופק מסמך חשבונאי — לביטול יש להשתמש בזיכוי ובמסמך זיכוי' };
  }

  const { data: items } = await service
    .from('order_items')
    .select('book_id, quantity, is_preorder')
    .eq('order_id', orderId);
  for (const item of items ?? []) {
    if (!item.book_id || item.is_preorder) continue;
    const result = await uncommitStock(service, item.book_id, item.quantity, orderId);
    if (!result.ok && result.reason !== 'nothing_to_uncommit') {
      return { ok: false, error: `שחרור מלאי נכשל: ${result.reason}` };
    }
  }

  const { data: updated, error: updateError } = await service
    .from('orders')
    .update({ payment_state: 'pending', state: 'pending', document_state: 'not_created', paid_at: null })
    .eq('id', orderId)
    .eq('payment_state', 'paid')
    .eq('state', 'confirmed')
    .select('*')
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated) return { ok: false, error: 'המצב השתנה בינתיים — רעננו ונסו שוב' };

  await service.from('payments').update({ status: 'cancelled' }).eq('id', payment.id);

  const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
  await recordOrderEvent(service, orderId, 'status_changed', actor, {
    axis: 'payment_state', from: 'paid', to: 'pending', undo: true, reason,
  });
  await recordOrderEvent(service, orderId, 'status_changed', actor, {
    axis: 'state', from: 'confirmed', to: 'pending', undo: true, reason,
  });
  if (order.document_state === 'pending') {
    await recordOrderEvent(service, orderId, 'status_changed', actor, {
      axis: 'document_state', from: 'pending', to: 'not_created', undo: true, reason,
    });
  }

  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * זיכוי דרך מורנינג (תרשים 15): admin בלבד, תקרת הזיכוי נאכפת גם במסד
 * (טריגר enforce_refund_cap). אישור כפול נעשה ב-UI; כאן ההגנה האחרונה.
 *
 * [1.4] אידמפוטנטיות אמיתית: המפתח נגזר מ-idempotencyToken שהלקוח מייצר
 * פעם אחת לכל ניסיון זיכוי (לא Date.now(), שהיה מייצר מפתח חדש בכל
 * שליחה — כלומר שתי לחיצות = שני זיכויים בפועל, כי uq_payments_idempotency
 * אף פעם לא נתקל באותו ערך פעמיים). לחיצה כפולה עם אותו טוקן פוגעת
 * ב-23505 ומוחזרת כ"כבר בוצע" בלי לחייב את מורנינג פעם שנייה.
 */
export async function refundOrder(
  orderId: string,
  amount: number,
  reason: string,
  idempotencyToken?: string,
): Promise<OrderActionResult> {
  const session = await assertFinanceOnOrders();
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

  // אכיפת התקרה גם כאן, לא רק בטריגר enforce_refund_cap שבמסד: ההערה
  // למעלה מבטיחה "כאן ההגנה האחרונה", וסביבה שבה מיגרציה 29 טרם רצה
  // הייתה נשארת בלי שום תקרה. נספרים גם initiated/pending — זיכוי
  // שיצא לדרך ועוד לא הוכרע תופס את חלקו בתקרה, כמו בטריגר.
  const { data: priorRefunds } = await service
    .from('payments')
    .select('amount')
    .eq('parent_payment_id', charge.id)
    .eq('kind', 'refund')
    .in('status', ['initiated', 'pending', 'succeeded']);
  const alreadyRefunded = (priorRefunds ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const refundable = round2(Number(charge.amount) - alreadyRefunded);
  if (amount > refundable + 0.01) {
    return {
      ok: false,
      error: `סכום הזיכוי חורג מהיתרה הניתנת לזיכוי (${refundable.toFixed(2)} ₪)`,
    };
  }

  const idempotencyKey = `refund:${orderId}:${idempotencyToken ?? `notoken:${Date.now()}`}`;
  const { data: insertedRow, error: insertError } = await service
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
      idempotency_key: idempotencyKey,
    })
    .select('*')
    .maybeSingle();

  const refundRow = insertedRow;
  if (insertError || !refundRow) {
    if (insertError?.code === '23505') {
      const { data: existing } = await service
        .from('payments')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existing?.status === 'succeeded') {
        // אותו ניסיון זיכוי בדיוק כבר הצליח — לא לחייב/לזכות שוב
        return { ok: true };
      }
      return {
        ok: false,
        error: 'בקשת הזיכוי הזו כבר בטיפול או נכשלה — רעננו את העמוד ונסו שוב',
      };
    }
    return { ok: false, error: insertError?.message ?? 'יצירת הזיכוי נכשלה (חריגה מהתקרה?)' };
  }

  let morningDocumentId: string | null = null;
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
    morningDocumentId = morningResult.data.documentId;
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

    // [1.4] מסמך זיכוי: לפני התיקון ה-documentId שחוזר ממורנינג נזרק
    // ו-document_state לא הגיע ל-credited לעולם. document_state עובר
    // ל-credited רק בזיכוי *מלא* (המסמך המקורי עדיין תקף בזיכוי חלקי).
    await recordCreditNote(service, orderRow as Order, {
      morningDocId: morningDocumentId,
      amount,
      paymentId: refundRow.id,
    });
    if (fullyRefunded) {
      await transitionOrder(service, orderId, 'document_state', 'credited', actor);
    }

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
  const session = await assertScreenPermission('orders', 'edit');
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
  // מסך ההרשאה הוא 'inventory' — הפעולה מופעלת ממסך המלאי, ומשתמש
  // שנחסם ממנו ב-override לא אמור לעקוף את החסימה דרך מפתח 'orders'.
  const session = await assertScreenPermission('inventory', 'edit');
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
  const session = await assertScreenPermission('inventory', 'edit');
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

/**
 * [1.5] אומדן חי לטופס ההזמנה הטלפונית (משלוח חינם מעל סף + קופון + מבצע
 * אוטומטי) — אותו resolvePricing שמשמש את createManualOrder בפועל, כדי
 * שמה שהנציג מקריא ללקוח בשיחה = מה שיירשם בהזמנה.
 */
export async function previewManualOrderTotalsAction(input: {
  items: ManualOrderItemInput[];
  fulfillment: ManualOrderFulfillment;
  couponCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}): Promise<ManualOrderPreview> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) {
    return {
      ok: false,
      error: session.error,
      subtotal: 0,
      shippingTotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      total: 0,
      freeShippingApplied: false,
      couponValid: false,
      couponError: null,
      promotionName: null,
    };
  }
  return previewManualOrderTotals({ ...input, locale: 'he' });
}

/**
 * הזמנה ידנית — ערוץ הטלפון (פרק 9.6): הצוות קולט את ההזמנה בשיחה.
 * מחירים מהקטלוג; [1.9] חריג יחיד — ספר בלי מחיר קטלוגי, שם הצוות מתמחר
 * את הפריט בטופס עצמו (manualUnitPrice, ראו validateCart/priceOverrides).
 * מלאי נשמר; ללקוח נשלח מייל אישור עם קישור מעקב.
 */
export async function createManualOrderAction(input: {
  items: ManualOrderItemInput[];
  contact: { name: string; phone: string; email: string | null };
  fulfillment:
    | { type: 'pickup' }
    | { type: 'shipping'; methodId: string; address: ShippingAddress; courierNotes?: string };
  couponCode: string | null;
  note: string | null;
  /** טוקן יציב מהטופס — הופך לחיצה כפולה ל"אותה הזמנה" במקום לשתיים. */
  idempotencyToken?: string;
}): Promise<OrderActionResult & { orderId?: string; orderNumber?: number }> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) return { ok: false, error: session.error };

  const result = await createManualOrder({
    ...input,
    locale: 'he',
    actor: { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
  });
  if (!result.ok || !result.order) return { ok: false, error: result.error };

  const service = createServiceClient();
  if (service && result.order.contact_email && result.guestToken) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
    await sendOrderEmail(service, 'order_confirmation', result.order, {
      trackUrl: `${siteUrl}/orders/track/${result.guestToken}`,
    });
  }

  revalidateOrders(result.order.id);
  return { ok: true, orderId: result.order.id, orderNumber: result.order.order_number };
}

/**
 * שליחת קישור תשלום מורנינג ללקוח במייל (משלים את ההזמנה הטלפונית):
 * ממחזר דף תשלום פתוח אם קיים; בלי מורנינג מוגדרת — שגיאה ברורה.
 */
export async function sendPaymentLink(orderId: string): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (!order.contact_email) return { ok: false, error: 'להזמנה אין כתובת מייל — גבו טלפונית וסמנו תשלום חיצוני' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const payment = await startPayment(order as Order, { siteUrl });
  if (!payment.ok || !payment.paymentUrl) {
    return {
      ok: false,
      error:
        payment.error === 'not_configured'
          ? 'מורנינג אינה מוגדרת (מפתחות API חסרים) — סמנו תשלום חיצוני במקום'
          : `יצירת דף התשלום נכשלה: ${payment.error}`,
    };
  }

  await sendOrderEmail(
    service,
    'order_confirmation',
    order as Order,
    { paymentUrl: payment.paymentUrl },
    `payment-link:${Date.now()}`,
  );
  await recordOrderEvent(service, orderId, 'payment_link_sent', {
    type: 'staff',
    id: session.userId,
    label: session.profile.full_name ?? undefined,
  }, { url_expires: true });

  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * [1.5] גביית תשלום באשראי בטלפון: יוצר את אותו דף תשלום מאובטח של
 * מורנינג כמו קישור המייל (sendPaymentLink), אך עם successUrl/failureUrl
 * שחוזרים לעמוד ההזמנה בניהול במקום checkout/result — ה-UI טוען את הדף
 * הזה בתוך iframe והנציג מקליד אליו את הפרטים שהלקוח מקריא בזמן השיחה,
 * כך שהם מגיעים אל מורנינג בלבד ולעולם אינם עוברים דרך השרת שלנו. בניגוד
 * לקישור המייל, אינה דורשת כתובת דוא״ל — בדיוק המקרה שבו "סימון תשלום
 * חיצוני" היה עד כה המוצא היחיד. מקור האמת למעבר ל-paid נשאר ה-Webhook
 * הקיים בלבד (webhook-processing.ts) — הפעולה הזו רק פותחת את דף התשלום.
 */
export async function startAdminCardPayment(
  orderId: string,
): Promise<{ ok: true; paymentUrl: string } | { ok: false; error: string }> {
  const session = await assertFinanceOnOrders();
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (!['pending', 'failed'].includes(order.payment_state)) {
    return { ok: false, error: `לא ניתן לגבות תשלום ממצב ${order.payment_state}` };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const result = await startPayment(order as Order, {
    siteUrl,
    successUrl: `${siteUrl}/admin/orders/${orderId}/payment-return?outcome=success`,
    failureUrl: `${siteUrl}/admin/orders/${orderId}/payment-return?outcome=failure`,
    actor: { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
  });
  if (!result.ok || !result.paymentUrl) {
    return {
      ok: false,
      error:
        result.error === 'not_configured'
          ? 'מורנינג אינה מוגדרת (מפתחות API חסרים) — סמנו תשלום חיצוני במקום'
          : `יצירת טופס התשלום נכשלה: ${result.error}`,
    };
  }
  return { ok: true, paymentUrl: result.paymentUrl };
}

/**
 * [1.3] עריכת פריטי הזמנה (פרק 9.7): מותרת רק כל עוד לא שולם ולא נארז —
 * שינוי סכום אחרי חיוב מחייב זיכוי/חיוב משלים (יגיע עם A13). המחירים
 * נשארים מהצילום; משתנות רק כמויות/שורות. סיבה חובה + מייל עדכון ללקוח.
 */
export async function editOrderItems(
  orderId: string,
  changes: { itemId: string; quantity: number }[],
  reason: string,
): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'edit');
  if ('error' in session) return { ok: false, error: session.error };
  if (!reason.trim()) return { ok: false, error: 'נדרשת סיבה לעריכה — נשלחת ללקוח ונשמרת בציר הזמן' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (!['pending', 'failed'].includes(order.payment_state)) {
    return {
      ok: false,
      error: 'ההזמנה שולמה — שינוי פריטים מחייב זיכוי או חיוב משלים (בצעו זיכוי חלקי במקום)',
    };
  }
  if (!['unfulfilled', 'preparing'].includes(order.fulfillment_state)) {
    return { ok: false, error: 'ההזמנה כבר נארזה/נשלחה — לא ניתן לערוך' };
  }

  const { data: items } = await service.from('order_items').select('*').eq('order_id', orderId);
  const byId = new Map((items ?? []).map((item) => [item.id, item]));
  const summary: string[] = [];

  for (const change of changes) {
    const item = byId.get(change.itemId);
    if (!item) continue;
    const next = Math.max(0, Math.floor(change.quantity));
    if (next === item.quantity) continue;

    // התאמת השריון במלאי דרך commerce_adjust_reservation — לא דרך
    // reserveStock/releaseStock: אלה חד-פעמיות לכל הזמנה (idempotent
    // לפי order+book+move_type), כך שקריאה שנייה מהן כאן החזירה
    // 'already_*' בלי לעשות דבר — הגדלת כמות לא שריינה את התוספת
    // (מכירת יתר), והקטנה שרפה את תנועת ה-release כך שהשחרור המלא
    // בביטול מאוחר יותר הפך ל-no-op והיתרה נתקעה משוריינת לנצח.
    if (item.book_id) {
      const adjust = await adjustReservation(service, item.book_id, next - item.quantity, orderId);
      if (!adjust.ok) {
        return { ok: false, error: `אין מספיק מלאי זמין עבור ${item.title_snapshot}` };
      }
    }

    if (next === 0) {
      await service.from('order_items').delete().eq('id', item.id);
      summary.push(`${item.title_snapshot}: הוסר`);
    } else {
      await service
        .from('order_items')
        .update({ quantity: next, line_total: Number(item.unit_price) * next })
        .eq('id', item.id);
      summary.push(`${item.title_snapshot}: ${item.quantity} → ${next}`);
    }
  }
  if (summary.length === 0) return { ok: false, error: 'לא בוצע שינוי' };

  await recomputeOrderTotals(service, orderId);
  const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
  await recordOrderEvent(service, orderId, 'order_edited', actor, { reason, changes: summary });

  const { data: fresh } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (fresh) {
    await sendOrderEmail(service, 'order_updated', fresh as Order, { updateReason: reason }, `edit:${Date.now()}`);
  }
  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * [1.3] שורת הנחת צוות מנומקת — "עריכת החשבונית" עד האריזה: מותרת רק
 * לפני תשלום (החיוב יוצא לפי הסכום המעודכן). ההנחה יושבת על ההזמנה
 * בנפרד מהקופון, עם סיבה שמופיעה בציר הזמן ובמייל.
 */
export async function setStaffDiscount(
  orderId: string,
  amount: number,
  reason: string,
): Promise<OrderActionResult> {
  const session = await assertFinanceOnOrders();
  if ('error' in session) return { ok: false, error: session.error };
  if (!(amount >= 0)) return { ok: false, error: 'סכום לא תקין' };
  if (amount > 0 && !reason.trim()) return { ok: false, error: 'נדרשת סיבה להנחה' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };
  if (!['pending', 'failed'].includes(order.payment_state)) {
    return { ok: false, error: 'ההזמנה שולמה — השתמשו בזיכוי במקום בהנחה' };
  }
  if (!['unfulfilled', 'preparing'].includes(order.fulfillment_state)) {
    return { ok: false, error: 'ההזמנה כבר נארזה — לא ניתן לשנות את החשבון' };
  }

  await service
    .from('orders')
    .update({ staff_discount: amount, staff_discount_reason: reason.trim() || null })
    .eq('id', orderId);
  await recomputeOrderTotals(service, orderId);

  const actor = { type: 'staff' as const, id: session.userId, label: session.profile.full_name ?? undefined };
  await recordOrderEvent(service, orderId, 'staff_discount_set', actor, { amount, reason });
  const { data: fresh } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (fresh) {
    await sendOrderEmail(service, 'order_updated', fresh as Order, { updateReason: reason }, `discount:${Date.now()}`);
  }
  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * חישוב מחדש של סכומי ההזמנה מהשורות + ההנחות שעל ההזמנה.
 *
 * משקף את computeTotals (checkout.ts) על הזמנה קיימת: תרומה שצולמה
 * בהזמנה נשארת בסכום (גרסה קודמת השמיטה אותה — עריכת פריטים על הזמנה
 * עם תרומה מחקה את התרומה מהסכום בשקט), ורכיב המע"מ מחושב מחדש —
 * אחרת tax_total הישן כבר אינו תואם את הסכום החדש.
 */
async function recomputeOrderTotals(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  orderId: string,
): Promise<void> {
  const [{ data: order }, { data: items }, settings] = await Promise.all([
    service.from('orders').select('*').eq('id', orderId).maybeSingle(),
    service.from('order_items').select('line_total, unit_price, quantity').eq('order_id', orderId),
    getStoreSettings(),
  ]);
  if (!order) return;
  const subtotal = round2(
    (items ?? []).reduce(
      (sum, item) => sum + Number(item.line_total ?? Number(item.unit_price) * item.quantity),
      0,
    ),
  );
  // ההנחות הקיימות על ההזמנה נשמרות כמו שהן (קופון/מבצע צולמו ביצירה)
  const couponAndPromo = Math.max(
    Number(order.discount_total) - Number(order.staff_discount ?? 0),
    0,
  );
  const discountTotal = round2(Math.min(couponAndPromo + Number(order.staff_discount ?? 0), subtotal));
  const shippingTotal = Number(order.shipping_total ?? 0);
  const donationAmount = Number(order.donation_amount ?? 0);
  const total = round2(Math.max(subtotal - discountTotal + shippingTotal + donationAmount, 0));
  const taxTotal =
    settings.vat_mode === 'included'
      ? round2(((subtotal - discountTotal + shippingTotal) * settings.vat_rate) / (100 + settings.vat_rate))
      : 0;
  await service
    .from('orders')
    .update({ subtotal, discount_total: discountTotal, total, tax_total: taxTotal })
    .eq('id', orderId);
}

/**
 * [1.3] ליקוט מפורט: כמה לוקט מכל פריט + הערת מלקט. מותר לסמן "נארזה"
 * גם כשלא הכל לוקט (מחסור) — מייל "נשלחה" יפרט מה נשלח בפועל.
 */
export async function savePickingState(
  orderId: string,
  picked: { itemId: string; pickedQuantity: number }[],
  packingNote: string | null,
): Promise<OrderActionResult> {
  const session = await assertScreenPermission('orders', 'view');
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  for (const entry of picked) {
    await service
      .from('order_items')
      .update({ picked_quantity: Math.max(0, Math.floor(entry.pickedQuantity)) })
      .eq('id', entry.itemId)
      .eq('order_id', orderId);
  }
  await service
    .from('orders')
    .update({ packing_note: packingNote?.trim().slice(0, 500) || null })
    .eq('id', orderId);

  await recordOrderEvent(
    service,
    orderId,
    'picking_updated',
    { type: 'staff', id: session.userId, label: session.profile.full_name ?? undefined },
    { note: packingNote ?? null },
  );
  revalidateOrders(orderId);
  return { ok: true };
}

/**
 * [1.3] מחיקת הזמנה — בלתי הפיכה, ולכן שמורה למקרים בטוחים בלבד:
 * הזמנה שלא שולמה מעולם (או בוטלה בלי זיכוי). הזמנה עם תשלום שהצליח
 * או מסמך — לעולם לא נמחקת (חובת שמירה 7 שנים); מבטלים במקום.
 */
export async function deleteOrder(orderId: string): Promise<OrderActionResult> {
  const session = await assertFinanceOnOrders();
  if ('error' in session) return { ok: false, error: session.error };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: order } = await service.from('orders').select('*').eq('id', orderId).maybeSingle();
  if (!order) return { ok: false, error: 'הזמנה לא נמצאה' };

  const { count: paidCount } = await service
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId)
    .eq('status', 'succeeded');
  const { count: docCount } = await service
    .from('documents')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', orderId);
  if ((paidCount ?? 0) > 0 || (docCount ?? 0) > 0) {
    return {
      ok: false,
      error: 'להזמנה תשלום שהצליח או מסמך חשבונאי — חובת שמירה; בטלו במקום למחוק',
    };
  }

  // שחרור שריונים לפני המחיקה (אם ההזמנה עוד פעילה)
  const { data: items } = await service
    .from('order_items')
    .select('book_id, quantity')
    .eq('order_id', orderId);
  for (const item of items ?? []) {
    if (item.book_id) await releaseStock(service, item.book_id, item.quantity, orderId);
  }

  // ילדים שאינם cascade: תשלומים (שלא הצליחו) ומימושי קופון
  await service.from('coupon_redemptions').delete().eq('order_id', orderId);
  await service.from('payments').delete().eq('order_id', orderId);
  const { error } = await service.from('orders').delete().eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'order_deleted',
      table_name: 'orders',
      record_id: orderId,
      old_values: { order_number: order.order_number, total: order.total },
      context: 'מחיקת הזמנה (ללא תשלום/מסמך)',
    });
  }
  revalidateOrders();
  return { ok: true };
}
