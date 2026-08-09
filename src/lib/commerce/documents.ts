import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentType, Order } from '@/lib/supabase/types';
import { transitionOrder, MORNING_ACTOR, recordOrderEvent, SYSTEM_ACTOR } from './orders';

/**
 * מסמכים חשבונאיים (תרשימים 9 ו-17). תרחיש הבסיס: המסמך מופק אוטומטית
 * על-ידי מורנינג עם העסקה, וה-Webhook נושא את פרטיו — כאן רק נרשם.
 * כשל מסמך לעולם אינו כשל תשלום: document_state=failed, ‏Retry, התראה.
 * מניעת כפילות: idempotency_key + partial unique על (order_id, doc_type).
 */

export async function recordDocument(
  service: SupabaseClient,
  order: Order,
  input: {
    docType: DocumentType;
    morningDocId: string | null;
    docNumber: string | null;
    amount: number;
    downloadUrl?: string | null;
    paymentId?: string | null;
  },
): Promise<void> {
  const { error } = await service.from('documents').insert({
    order_id: order.id,
    payment_id: input.paymentId ?? null,
    provider: 'morning',
    morning_doc_id: input.morningDocId,
    doc_type: input.docType,
    doc_number: input.docNumber,
    issued_at: new Date().toISOString(),
    amount: input.amount,
    currency: order.currency,
    status: 'created',
    download_url: input.downloadUrl ?? null,
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
    idempotency_key: `order:${order.id}:${input.docType}`,
  });

  if (error) {
    // 23505: המסמך כבר נרשם (Webhook כפול) — אין מה לעשות, וזה בסדר גמור
    if (error.code !== '23505') {
      console.error('[commerce:documents] record', error.message);
      await markDocumentFailed(service, order, input.docType, error.message);
      return;
    }
  } else {
    await recordOrderEvent(service, order.id, 'document_created', MORNING_ACTOR, {
      doc_type: input.docType,
      doc_number: input.docNumber,
    });
  }

  await transitionOrder(service, order.id, 'document_state', 'created', MORNING_ACTOR);
}

/**
 * [1.4] מסמך זיכוי: לפני התיקון ה-documentId שחוזר מ-refundTransaction
 * נזרק, ו-document_state אף פעם לא הגיע ל-credited. שורת מסמך אחת
 * לכל הזמנה (כמו uq_documents_live_per_order) — זיכוי חלקי נוסף על
 * אותה הזמנה מצטבר לאותה שורה במקום להתנגש בה.
 */
export async function recordCreditNote(
  service: SupabaseClient,
  order: Order,
  input: { morningDocId: string | null; amount: number; paymentId: string },
): Promise<void> {
  const { data: existing } = await service
    .from('documents')
    .select('id, amount, morning_doc_id')
    .eq('order_id', order.id)
    .eq('doc_type', 'credit_note')
    .eq('status', 'created')
    .maybeSingle();

  if (existing) {
    const patch: Record<string, unknown> = {
      amount: Number(existing.amount) + input.amount,
      payment_id: input.paymentId,
      updated_at: new Date().toISOString(),
    };
    if (!existing.morning_doc_id && input.morningDocId) patch.morning_doc_id = input.morningDocId;
    await service.from('documents').update(patch).eq('id', existing.id);
  } else {
    const { error } = await service.from('documents').insert({
      order_id: order.id,
      payment_id: input.paymentId,
      provider: 'morning',
      morning_doc_id: input.morningDocId,
      doc_type: 'credit_note',
      issued_at: new Date().toISOString(),
      amount: input.amount,
      currency: order.currency,
      status: 'created',
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
      idempotency_key: `order:${order.id}:credit_note`,
    });
    if (error && error.code !== '23505') {
      console.error('[commerce:documents] credit note', error.message);
      return;
    }
  }

  await recordOrderEvent(service, order.id, 'document_created', MORNING_ACTOR, {
    doc_type: 'credit_note',
    amount: input.amount,
  });
}

export async function markDocumentFailed(
  service: SupabaseClient,
  order: Order,
  docType: DocumentType,
  errorMessage: string,
): Promise<void> {
  // רישום כשל בטבלה (אם אין רשומה חיה) + ציר המסמך של ההזמנה
  const { error } = await service.from('documents').insert({
    order_id: order.id,
    provider: 'morning',
    doc_type: docType,
    amount: order.total,
    currency: order.currency,
    status: 'failed',
    error: errorMessage,
    attempts: 1,
    last_attempt_at: new Date().toISOString(),
    idempotency_key: `order:${order.id}:${docType}:failed:${Date.now()}`,
  });
  if (error && error.code !== '23505') {
    console.error('[commerce:documents] mark failed', error.message);
  }
  await recordOrderEvent(service, order.id, 'document_failed', SYSTEM_ACTOR, {
    doc_type: docType,
    error: errorMessage,
  });
  await transitionOrder(service, order.id, 'document_state', 'failed', SYSTEM_ACTOR);
}
