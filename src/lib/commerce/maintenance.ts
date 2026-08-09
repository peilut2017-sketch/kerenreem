import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getStoreSettings } from './settings';
import { transitionOrder, SYSTEM_ACTOR } from './orders';
import { releaseStock } from './inventory';
import { sendOrderEmail, sendPlainEmail } from './notifications';
import type { Order } from '@/lib/supabase/types';

/**
 * [1.2] משימות התחזוקה שהאפיון דורש ולא היו ממומשות (פרקים 9, 13, 14, 16):
 * ביטול שקט של pending שפג, סגירת הזמנות אחרי חלון ההחזרה, טיהור
 * checkout_sessions נטושים בתום ה-retention, והתראות חזרה-למלאי.
 * כולן idempotent-יות — ריצה כפולה אינה מזיקה. מופעלות מ-cron.
 */

/** ‏pending בלי תשלום שהצליח, בן 7 ימים ומעלה ⇒ ביטול שקט + שחרור שמירות. */
export async function expireStalePendingOrders(days = 7): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  const { data: stale } = await service
    .from('orders')
    .select('*')
    .eq('state', 'pending')
    .in('payment_state', ['pending', 'failed'])
    .lt('created_at', cutoff)
    .limit(50);

  let cancelled = 0;
  for (const order of stale ?? []) {
    const result = await transitionOrder(service, order.id, 'state', 'cancelled', SYSTEM_ACTOR, {
      reason: 'pending_expired',
    });
    if (!result.ok) continue;
    const { data: items } = await service
      .from('order_items')
      .select('book_id, quantity')
      .eq('order_id', order.id);
    for (const item of items ?? []) {
      if (item.book_id) await releaseStock(service, item.book_id, item.quantity, order.id);
    }
    await sendOrderEmail(service, 'cancelled', result.order ?? (order as Order));
    cancelled += 1;
  }
  return cancelled;
}

/** ‏completed ⇒ closed אחרי חלון ההחזרה (14.5) — סגירה חשבונאית שקטה. */
export async function autoCloseCompletedOrders(returnWindowDays = 30): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const cutoff = new Date(Date.now() - returnWindowDays * 24 * 60 * 60_000).toISOString();
  const { data: done } = await service
    .from('orders')
    .select('id, completed_at')
    .eq('state', 'completed')
    .lt('completed_at', cutoff)
    .limit(100);

  let closed = 0;
  for (const order of done ?? []) {
    const result = await transitionOrder(service, order.id, 'state', 'closed', SYSTEM_ACTOR, {
      reason: 'return_window_elapsed',
    });
    if (result.ok) closed += 1;
  }
  return closed;
}

/** טיהור checkout_sessions ישנים בתום ה-retention (החלטה 15) — כולל ה-PII. */
export async function purgeAbandonedSessions(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;
  const settings = await getStoreSettings();
  const cutoff = new Date(
    Date.now() - settings.abandoned_retention_days * 24 * 60 * 60_000,
  ).toISOString();
  const { data, error } = await service
    .from('checkout_sessions')
    .delete()
    .neq('status', 'converted')
    .lt('created_at', cutoff)
    .select('id');
  if (error) {
    console.error('[commerce:maintenance] purge sessions', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * התראות חזרה-למלאי (פרק 16.4): נרשמים שממתינים + הספר חזר להיות זמין
 * ⇒ מייל אחד לכל נרשם וסימון notified_at. שליחה שנכשלה נשארת ממתינה
 * לריצה הבאה.
 */
export async function notifyBackInStock(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;

  const { data: pending } = await service
    .from('back_in_stock_subscriptions')
    .select('id, book_id, email')
    .is('notified_at', null)
    .limit(200);
  if (!pending || pending.length === 0) return 0;

  const bookIds = [...new Set(pending.map((sub) => sub.book_id))];
  const { data: books } = await service
    .from('books')
    .select('id, title_he, slug, stock_quantity, is_purchasable, is_published')
    .in('id', bookIds);
  const available = new Map(
    (books ?? [])
      .filter((b) => b.is_published && b.is_purchasable && (b.stock_quantity ?? 0) > 0)
      .map((b) => [b.id, b] as const),
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  let sent = 0;
  for (const sub of pending) {
    const book = available.get(sub.book_id);
    if (!book || !sub.email) continue;
    const result = await sendPlainEmail(
      sub.email,
      `הספר ״${book.title_he}״ חזר למלאי — מכון קרן רא״ם`,
      `<h2 style="margin:0 0 12px">בשורה טובה!</h2>
       <p>הספר <strong>${book.title_he}</strong> שביקשת לדעת עליו — חזר למלאי.</p>
       <p style="margin:16px 0"><a href="${siteUrl}/books/${book.slug}" style="background:#1f1c17;color:#fff;border-radius:999px;padding:12px 24px;text-decoration:none;display:inline-block">לעמוד הספר</a></p>
       <p style="color:#8a8577;font-size:13px">קיבלת את המייל כי נרשמת לעדכון חזרה למלאי. זו הודעה חד-פעמית.</p>`,
    );
    if (result.ok) {
      await service
        .from('back_in_stock_subscriptions')
        .update({ notified_at: new Date().toISOString() })
        .eq('id', sub.id);
      sent += 1;
    }
  }
  return sent;
}
