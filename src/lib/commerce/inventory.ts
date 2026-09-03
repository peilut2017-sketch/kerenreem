import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import type { Book } from '@/lib/supabase/types';

/**
 * עטיפות דקות לפונקציות המלאי האטומיות שבמסד (30_inventory.sql).
 * הנעילה, בדיקת הזמינות, איסור השלילי, ה-ledger וה-idempotency — כולם
 * שם, בטרנזקציה אחת; כאן רק הקריאה והטיפוס.
 *
 * ספר שאינו מנוהל-מלאי (is_stock_managed=false) או בהזמנה מוקדמת —
 * מדלג על שמירה/הפחתה: אין מה לשמור.
 */


export interface StockOpResult {
  ok: boolean;
  reason: string;
  available?: number;
}

async function callStockFn(
  service: SupabaseClient,
  fn:
    | 'commerce_reserve_stock'
    | 'commerce_commit_stock'
    | 'commerce_release_stock'
    | 'commerce_uncommit_stock',
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

/**
 * [1.5] היפוך commitStock — לביטול סימון תשלום ידני שבוצע בטעות (לא
 * לביטול הזמנה: שם המלאי חוזר ל-on_hand חופשי, כאן הוא חוזר ל-reserved
 * כי ההזמנה עדיין פעילה, רק שהתשלום חזר להיות לא-סופי).
 */
export function uncommitStock(service: SupabaseClient, bookId: string, qty: number, orderId: string) {
  return callStockFn(service, 'commerce_uncommit_stock', bookId, qty, orderId);
}

/**
 * התאמת שריון קיים בעריכת כמויות הזמנה (52_commerce_hardening.sql).
 *
 * reserveStock/releaseStock הן חד-פעמיות במחזור חיי ההזמנה — קריאה
 * שנייה מחזירה 'already_*' בלי לעשות דבר. עריכת כמות חייבת לכן לעבור
 * כאן: delta חיובי משריין את התוספת (נבדק מול הזמין), שלילי משחרר
 * חלקית. כשאין שריון פעיל להזמנה (ספר לא מנוהל-מלאי) — no-op מוצלח.
 */
export async function adjustReservation(
  service: SupabaseClient,
  bookId: string,
  delta: number,
  orderId: string,
): Promise<StockOpResult> {
  const { data, error } = await service.rpc('commerce_adjust_reservation', {
    p_book_id: bookId,
    p_delta: delta,
    p_order_id: orderId,
  });
  if (error) {
    console.error('[commerce:inventory] adjust_reservation', error.message);
    return { ok: false, reason: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    reason: String(row?.reason ?? 'unknown'),
    available: typeof row?.available === 'number' ? row.available : undefined,
  };
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
    /** [1.1] מיקום מפורש (ריבוי מחסנים); null = המיקום הראשי */
    locationId?: string | null;
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
    p_location_id: input.locationId ?? null,
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

/** [1.1] העברה אטומית בין מיקומים — transfer_out במקור + transfer_in ביעד. */
export async function transferStock(
  service: SupabaseClient,
  input: {
    bookId: string;
    fromLocationId: string;
    toLocationId: string;
    qty: number;
    actorId?: string;
    note?: string;
  },
): Promise<StockOpResult> {
  const { data, error } = await service.rpc('commerce_transfer_stock', {
    p_book_id: input.bookId,
    p_from_location: input.fromLocationId,
    p_to_location: input.toLocationId,
    p_qty: input.qty,
    p_actor_id: input.actorId ?? null,
    p_note: input.note ?? null,
  });
  if (error) {
    console.error('[commerce:inventory] transfer', error.message);
    return { ok: false, reason: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: Boolean(row?.ok), reason: String(row?.reason ?? 'unknown') };
}

/**
 * [1.3/1.4] תיקון סנכרון טופס הספר: books.stock_quantity הוא מטמון נגזר —
 * כתיבה ישירה אליו נדרסת בטריגר וה-ledger עיוור לה. במקום זה, הערך
 * שהוזן בטופס מיושם כתנועת "ספירה" (count) על מיקום ברירת המחדל: הפרש
 * מול המלאי הפיזי הקיים, דרך הפונקציה האטומית — המטמון וה-ledger
 * נשארים עקביים, וההיסטוריה מלאה. (הערך המוצג בטופס עצמו חייב להיות
 * on_hand אמיתי ולא הזמין — ראו book-form-data.ts.)
 *
 * ספר עם מלאי בכמה מחסנים: אין דרך לדעת מאיזה מחסן להוסיף/להוריד
 * מטופס יחיד בלי בחירת מיקום, ולכן לא זוקפים את ההפרש בשקט למחסן
 * הראשי (זה היה מייצר פילוח שגוי בין מחסנים) — מסרבים ומפנים למסך
 * המלאי, שם יש בחירת מיקום מפורשת.
 */
export async function reconcileBookStockFromForm(
  bookId: string,
  targetOnHand: number,
  actorId?: string,
): Promise<StockOpResult & { onHand?: number }> {
  const service = createServiceClient();
  if (!service) return { ok: false, reason: 'not_configured' };

  const { data: levels } = await service
    .from('inventory_levels')
    .select('on_hand')
    .eq('book_id', bookId);
  const rows = levels ?? [];
  const current = rows.reduce((sum, level) => sum + level.on_hand, 0);
  const delta = targetOnHand - current;
  if (delta === 0) return { ok: true, reason: 'unchanged', onHand: current };
  if (rows.length > 1) return { ok: false, reason: 'multi_location', onHand: current };

  return adjustStock(service, {
    bookId,
    delta,
    moveType: 'count',
    reason: 'עדכון כמות מטופס הספר',
    actorId,
  });
}
