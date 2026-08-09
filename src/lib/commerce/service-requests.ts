import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordOrderEvent, type Actor } from './orders';

/**
 * [1.5] בקשות שירות (ביטול/החזרה) — ישות אמיתית (migration 40) במקום
 * תג+אירוע בלבד. עד כה "בקשת ביטול" חייתה רק כתג cancel-requested על
 * ההזמנה, ש-cancelOrder אינו נוגע בו כלל — ולכן נשאר לנצח והתור באדמין
 * נסתם עם הזמנות שכבר טופלו. כאן: פתיחה, ופתרון (resolveServiceRequest)
 * שמנקה גם את התג הישן כדי שתצוגת "בקשות ביטול" הקיימת תתעדכן בהתאם.
 */

export interface ServiceRequestItem {
  bookId: string;
  title: string;
  quantity: number;
}

export interface ServiceRequestRow {
  id: string;
  order_id: string;
  kind: 'cancel' | 'return';
  status: 'open' | 'in_progress' | 'resolved' | 'declined';
  reason: string | null;
  requested_by: 'customer' | 'staff';
  items: ServiceRequestItem[] | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export async function openServiceRequest(
  service: SupabaseClient,
  input: {
    orderId: string;
    kind: 'cancel' | 'return';
    reason: string;
    requestedBy: 'customer' | 'staff';
    items?: ServiceRequestItem[];
    actor: Actor;
  },
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await service.from('service_requests').insert({
    order_id: input.orderId,
    kind: input.kind,
    reason: input.reason.trim().slice(0, 500) || null,
    requested_by: input.requestedBy,
    items: input.items && input.items.length > 0 ? input.items : null,
  });
  if (error) {
    // כבר קיימת בקשה פתוחה מאותו סוג על ההזמנה — לא כפילות, לא כשל
    if (error.code === '23505') return { ok: true };
    return { ok: false, error: error.message };
  }
  await recordOrderEvent(
    service,
    input.orderId,
    input.kind === 'cancel' ? 'cancel_requested' : 'return_requested',
    input.actor,
    { reason: input.reason, requested_by: input.requestedBy },
  );
  // [1.4→1.5] המשך תאימות לתצוגת "בקשות ביטול" הקיימת ברשימת ההזמנות,
  // שמסתמכת על התג — לא מוחלף כאן, רק ניזון גם משתי הזרימות (אורח וחשבון)
  if (input.kind === 'cancel') {
    const { data: order } = await service.from('orders').select('tags').eq('id', input.orderId).maybeSingle();
    await service
      .from('orders')
      .update({ tags: [...new Set([...(order?.tags ?? []), 'cancel-requested'])] })
      .eq('id', input.orderId);
  }
  return { ok: true };
}

export async function resolveServiceRequest(
  service: SupabaseClient,
  requestId: string,
  status: 'resolved' | 'declined',
  note: string,
  resolvedBy: string,
): Promise<{ ok: boolean; error?: string; orderId?: string }> {
  const { data: request } = await service
    .from('service_requests')
    .select('order_id, kind, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!request) return { ok: false, error: 'בקשה לא נמצאה' };
  if (request.status === 'resolved' || request.status === 'declined') {
    return { ok: true, orderId: request.order_id }; // כבר טופלה — אידמפוטנטי
  }

  const { error } = await service
    .from('service_requests')
    .update({
      status,
      resolution_note: note.trim().slice(0, 500) || null,
      resolved_at: new Date().toISOString(),
      resolved_by: resolvedBy,
    })
    .eq('id', requestId);
  if (error) return { ok: false, error: error.message };

  // ניקוי התג — כאן בדיוק היה הבאג: cancelOrder אף פעם לא ניקה אותו
  if (request.kind === 'cancel') {
    const { data: order } = await service.from('orders').select('tags').eq('id', request.order_id).maybeSingle();
    if (order?.tags?.includes('cancel-requested')) {
      await service
        .from('orders')
        .update({ tags: (order.tags as string[]).filter((tag) => tag !== 'cancel-requested') })
        .eq('id', request.order_id);
    }
  }

  return { ok: true, orderId: request.order_id };
}

/** מסמנת פתורות את כל בקשות הביטול הפתוחות על הזמנה — לקריאה מ-cancelOrder. */
export async function resolveOpenCancelRequests(
  service: SupabaseClient,
  orderId: string,
  resolvedBy: string,
): Promise<void> {
  const { data: open } = await service
    .from('service_requests')
    .select('id')
    .eq('order_id', orderId)
    .eq('kind', 'cancel')
    .in('status', ['open', 'in_progress']);
  for (const row of open ?? []) {
    await resolveServiceRequest(service, row.id, 'resolved', 'ההזמנה בוטלה', resolvedBy);
  }
  // גם הזמנות בלי שורת service_requests (מהתקופה שלפני המעבר, או תג בלי
  // בקשה תקינה) — ניקוי ישיר של התג כדי שלא יישאר תקוע
  const { data: order } = await service.from('orders').select('tags').eq('id', orderId).maybeSingle();
  if (order?.tags?.includes('cancel-requested')) {
    await service
      .from('orders')
      .update({ tags: (order.tags as string[]).filter((tag) => tag !== 'cancel-requested') })
      .eq('id', orderId);
  }
}
