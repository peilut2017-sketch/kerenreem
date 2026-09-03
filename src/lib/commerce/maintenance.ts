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
    // שחרור המלאי *לפני* הביטול, לא אחריו: אם התהליך מת בין הביטול
    // לשחרור, הריצה הבאה מסננת state='pending' ולא חוזרת להזמנה — והשריון
    // היה נתקע לנצח. release אידמפוטנטי (מדלג אם כבר שוחרר), כך שאם הביטול
    // נכשל אחרי השחרור, הריצה הבאה פשוט תריץ שוב את שניהם בלי נזק.
    const { data: items } = await service
      .from('order_items')
      .select('book_id, quantity')
      .eq('order_id', order.id);
    for (const item of items ?? []) {
      if (item.book_id) await releaseStock(service, item.book_id, item.quantity, order.id);
    }
    // guard על payment_state: אם הלקוח שילם את ההזמנה הישנה בדיוק עכשיו
    // (‏Webhook תוך כדי ריצת ה-cron), הביטול נחסם אטומית — הזמנה ששולמה
    // אינה עוברת ל-cancelled בלי מסלול זיכוי. הצילום נקרא כ-pending/failed;
    // אם השתנה, ה-guard לא מתקיים והביטול מדלג. changed מבדיל ביטול בפועל
    // מ"כבר בוטל", כדי לא לשלוח מייל ביטול פעמיים.
    const result = await transitionOrder(
      service,
      order.id,
      'state',
      'cancelled',
      SYSTEM_ACTOR,
      { reason: 'pending_expired' },
      { payment_state: order.payment_state },
    );
    if (!result.ok || !result.changed) continue;
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
    // changed ולא ok: ok=true גם למי שכבר היה closed — הדוח ניפח "נסגרו"
    if (result.ok && result.changed) closed += 1;
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
    // תפיסת השורה *לפני* השליחה, בעדכון מותנה ב-notified_at IS NULL: בלי
    // idempotency-log למייל הזה, ריצות חופפות (הקצב מתוכנן לרדת ל-~10 דק')
    // או קריסה+ריצה חוזרת היו שולחות מייל כפול לכל נרשם. מי שתפס את השורה
    // (‏select מחזיר אותה) שולח; שאר הריצות רואות 0 שורות ומדלגות.
    const claimedAt = new Date().toISOString();
    const { data: claimed } = await service
      .from('back_in_stock_subscriptions')
      .update({ notified_at: claimedAt })
      .eq('id', sub.id)
      .is('notified_at', null)
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    const result = await sendPlainEmail(
      sub.email,
      `הספר ״${book.title_he}״ חזר למלאי — מכון קרן רא״ם`,
      `<h2 style="margin:0 0 12px">בשורה טובה!</h2>
       <p>הספר <strong>${book.title_he}</strong> שביקשת לדעת עליו — חזר למלאי.</p>
       <p style="margin:16px 0"><a href="${siteUrl}/books/${book.slug}" style="background:#1f1c17;color:#fff;border-radius:999px;padding:12px 24px;text-decoration:none;display:inline-block">לעמוד הספר</a></p>
       <p style="color:#8a8577;font-size:13px">קיבלת את המייל כי נרשמת לעדכון חזרה למלאי. זו הודעה חד-פעמית.</p>`,
    );
    if (result.ok) {
      sent += 1;
    } else {
      // השליחה נכשלה — משחררים את התפיסה שלנו (רק אותה) כדי שהריצה הבאה
      // תנסה שוב, במקום לסמן "נשלח" בלי שנשלח דבר.
      await service
        .from('back_in_stock_subscriptions')
        .update({ notified_at: null })
        .eq('id', sub.id)
        .eq('notified_at', claimedAt);
    }
  }
  return sent;
}

/**
 * טיהור שורות rate_limits ישנות. commerce_rate_limit מוחקת בכל קריאה רק
 * את השורות הישנות של *הדלי הנוכחי* — דלי שהפסיק לקבל תעבורה (IP חולף,
 * מספר הזמנה חד-פעמי) משאיר את שורותיו לנצח, והטבלה גדלה בלי גבול.
 * החלון הארוך ביותר בקוד הוא שעה; יום שלם משאיר שוליים בטוחים בהרבה.
 */
export async function purgeStaleRateLimits(): Promise<number> {
  const service = createServiceClient();
  if (!service) return 0;
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data, error } = await service
    .from('rate_limits')
    .delete()
    .lt('hit_at', cutoff)
    .select('id');
  if (error) {
    console.error('[commerce:maintenance] purge rate_limits', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * טיהור טבלאות האנליטיקה בעלות הנפח הגבוה ביותר. עד עכשיו page_views
 * ו-commerce_events גדלו לנצח (בניגוד ל-webhooks/sessions/rate_limits
 * שכן מטוהרים), בזמן שקריאות הדוחות עליהן חתוכות בתקרת שורות — כלומר
 * הטבלה תופחת והדיווח נהיה פחות מדויק. ‏395 יום שומר השוואה שנה-מול-שנה.
 * מוגדר לפי דגל: ריצה אחת מוחקת עד 50 אלף שורות כדי לא לחסום את ה-cron.
 */
const ANALYTICS_RETENTION_DAYS = 395;

async function purgeOldRows(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  table: 'page_views' | 'commerce_events',
): Promise<number> {
  const cutoff = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  // מחיקה בבאצ' דרך תת-שאילתת id: DELETE ישיר עם limit אינו נתמך ב-PostgREST.
  const { data: old, error: selectError } = await service
    .from(table)
    .select('id')
    .lt('created_at', cutoff)
    .limit(50_000);
  if (selectError || !old?.length) {
    if (selectError) console.error(`[commerce:maintenance] purge ${table} select`, selectError.message);
    return 0;
  }
  const { error } = await service
    .from(table)
    .delete()
    .in('id', old.map((row) => row.id));
  if (error) {
    console.error(`[commerce:maintenance] purge ${table}`, error.message);
    return 0;
  }
  return old.length;
}

export async function purgeOldAnalytics(): Promise<{ pageViews: number; commerceEvents: number }> {
  const service = createServiceClient();
  if (!service) return { pageViews: 0, commerceEvents: 0 };
  return {
    pageViews: await purgeOldRows(service, 'page_views'),
    commerceEvents: await purgeOldRows(service, 'commerce_events'),
  };
}
