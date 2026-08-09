import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { DocumentType } from '@/lib/supabase/types';

/** [1.5] מסמכים חשבונאיים — סטטוס הפקה מול מורנינג, לא תוכן המסמך עצמו (זה תפקיד מורנינג). */

export interface DocumentTypeCount {
  docType: DocumentType;
  created: number;
  pending: number;
  failed: number;
}

export interface FailedDocumentRow {
  id: string;
  orderId: string;
  orderNumber: number;
  docType: DocumentType;
  error: string | null;
  attempts: number;
  lastAttemptAt: string | null;
}

export interface DocumentsReport {
  byType: DocumentTypeCount[];
  failed: FailedDocumentRow[];
  totalPending: number;
  error: boolean;
}

const DOC_TYPES: DocumentType[] = ['invoice_receipt', 'receipt', 'donation_receipt', 'credit_note'];

export async function getDocumentsReport(): Promise<DocumentsReport> {
  const supabase = await createClient();
  if (!supabase) return { byType: [], failed: [], totalPending: 0, error: true };

  const { data: docs } = await supabase
    .from('documents')
    .select('id, order_id, doc_type, status, error, attempts, last_attempt_at')
    .order('last_attempt_at', { ascending: false })
    .limit(5000);
  const rows = docs ?? [];

  const byType: DocumentTypeCount[] = DOC_TYPES.map((docType) => {
    const forType = rows.filter((d) => d.doc_type === docType);
    return {
      docType,
      created: forType.filter((d) => d.status === 'created').length,
      pending: forType.filter((d) => d.status === 'pending').length,
      failed: forType.filter((d) => d.status === 'failed').length,
    };
  });

  const failedRows = rows.filter((d) => d.status === 'failed');
  const orderIds = [...new Set(failedRows.map((d) => d.order_id))];
  const orderNumberById = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: orders } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
    for (const order of orders ?? []) orderNumberById.set(order.id, order.order_number);
  }

  return {
    byType,
    failed: failedRows.slice(0, 100).map((d) => ({
      id: d.id,
      orderId: d.order_id,
      orderNumber: orderNumberById.get(d.order_id) ?? 0,
      docType: d.doc_type,
      error: d.error,
      attempts: d.attempts,
      lastAttemptAt: d.last_attempt_at,
    })),
    totalPending: rows.filter((d) => d.status === 'pending').length,
    error: false,
  };
}
