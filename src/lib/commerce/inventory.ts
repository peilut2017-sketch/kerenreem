import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '@/lib/supabase/types';

/**
 * עטיפות דקות לפונקציות המלאי האטומיות שבמסד (30_inventory.sql).
 * הנעילה, בדיקת הזמינות, איסור השלילי, ה-ledger וה-idempotency — כולם
 * שם, בטרנזקציה אחת; כאן רק הקריאה והטיפוס.
 *
 * ספר שאינו מנוהל-מלאי (is_stock_managed=false) או בהזמנה מוקדמת —
 * מדלג על שמירה/הפחתה: אין מה לשמור.
 */

type ManagedBook = Pick<Book, 'id' | 'is_stock_managed' | 'preorder_enabled'>;

export function needsStockManagement(book: ManagedBook): boolean {
  return book.is_stock_managed !== false && !book.preorder_enabled;
}

export interface StockOpResult {
  ok: boolean;
  reason: string;
  available?: number;
}

async function callStockFn(
  service: SupabaseClient,
  fn: 'commerce_reserve_stock' | 'commerce_commit_stock' | 'commerce_release_stock',
  bookId: string,
  qty: number,
  orderId: string,
): Promise<StockOpResult> {
  const { data, error } = await service.rpc(fn, {
    p_book_id: bookId,
    p_qty: qty,
    p_order_id: orderId,
  });
  if (error) {
    console.error(`[commerce:inventory] ${fn}`, error.message);
    return { ok: false, reason: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    reason: String(row?.reason ?? 'unknown'),
    available: typeof row?.available === 'number' ? row.available : undefined,
  };
}

export function reserveStock(service: SupabaseClient, bookId: string, qty: number, orderId: string) {
  return callStockFn(service, 'commerce_reserve_stock', bookId, qty, orderId);
}

export function commitStock(service: SupabaseClient, bookId: string, qty: number, orderId: string) {
  return callStockFn(service, 'commerce_commit_stock', bookId, qty, orderId);
}

export function releaseStock(service: SupabaseClient, bookId: string, qty: number, orderId: string) {
  return callStockFn(service, 'commerce_release_stock', bookId, qty, orderId);
}

/** תנועה ידנית: קליטה, החזרה למלאי, נזק, תיקון, ספירה. לעולם לא set ישיר. */
export async function adjustStock(
  service: SupabaseClient,
  input: {
    bookId: string;
    delta: number;
    moveType: 'receive' | 'cancel_restock' | 'return_restock' | 'damage' | 'manual_adjust' | 'count';
    reason?: string;
    orderId?: string;
    actorId?: string;
    note?: string;
  },
): Promise<StockOpResult & { onHand?: number }> {
  const { data, error } = await service.rpc('commerce_adjust_stock', {
    p_book_id: input.bookId,
    p_delta: input.delta,
    p_move_type: input.moveType,
    p_reason: input.reason ?? null,
    p_order_id: input.orderId ?? null,
    p_actor_id: input.actorId ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    console.error('[commerce:inventory] adjust', error.message);
    return { ok: false, reason: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    reason: String(row?.reason ?? 'unknown'),
    onHand: typeof row?.on_hand === 'number' ? row.on_hand : undefined,
  };
}
