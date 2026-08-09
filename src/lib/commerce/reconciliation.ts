import 'server-only';
import { createServiceClient } from '@/lib/supabase/service';
import { getTransactionStatus, isMorningConfigured } from './morning';
import { recordOrderEvent, SYSTEM_ACTOR } from './orders';
import { round2 } from './pricing';

/**
 * [1.1] התאמה אוטומטית בסיסית מול מורנינג — שער G3 (תוכנית המימוש) ותנאי
 * פתיחה 20: הצלבה יומית של payments שהצליחו מול סטטוס העסקה אצל הספק.
 * פער (סטטוס/סכום) מסמן את ההזמנה בתג reconcile-mismatch, נרשם בציר
 * הזמן ומופיע בדוח ההתאמות — אין אישור אוטומטי ואין תיקון אוטומטי:
 * הכרעה על פער היא תמיד של הצוות.
 */

export interface ReconciliationSummary {
  checked: number;
  matched: number;
  mismatched: number;
  unreachable: number;
  skipped: 'not_configured' | null;
}

/**
 * [1.4] שמירת תוצאת ההרצה ב-reconciliation_runs (migration 39) — בלי זה
 * אין "מתי רצה לאחרונה", ואם המפתחות חסרים ההתאמה פשוט לא רצה וה-UI
 * (שמסתמך על "אין תגי mismatch" בלבד) היה מראה "הכול תקין" בטעות.
 * נשמר גם כשההתאמה דולגה — כדי שדוח ה-UI יבחין בין "בדקנו, הכול תואם"
 * ל"לא בדקנו בכלל".
 */
async function persistRun(
  service: ReturnType<typeof createServiceClient>,
  summary: ReconciliationSummary,
): Promise<void> {
  if (!service) return;
  await service.from('reconciliation_runs').insert({
    checked: summary.checked,
    matched: summary.matched,
    mismatched: summary.mismatched,
    unreachable: summary.unreachable,
    skipped: summary.skipped,
  });
}

export async function reconcileRecentPayments(days = 3): Promise<ReconciliationSummary> {
  const summary: ReconciliationSummary = {
    checked: 0,
    matched: 0,
    mismatched: 0,
    unreachable: 0,
    skipped: null,
  };
  if (!isMorningConfigured()) {
    summary.skipped = 'not_configured';
    await persistRun(createServiceClient(), summary);
    return summary;
  }
  const service = createServiceClient();
  if (!service) {
    summary.skipped = 'not_configured';
    return summary;
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
  const { data: payments } = await service
    .from('payments')
    .select('id, order_id, amount, status, morning_transaction_id')
    .eq('provider', 'morning')
    .eq('kind', 'charge')
    .eq('status', 'succeeded')
    .gte('created_at', cutoff)
    .limit(200);

  for (const payment of payments ?? []) {
    summary.checked += 1;
    const result = await getTransactionStatus(payment.order_id);
    if (!result.ok) {
      summary.unreachable += 1;
      continue;
    }

    const statusMatches = result.data.status === 'paid';
    const amountMatches =
      result.data.amount == null || round2(result.data.amount) === round2(Number(payment.amount));

    if (statusMatches && amountMatches) {
      summary.matched += 1;
      continue;
    }

    summary.mismatched += 1;
    await recordOrderEvent(service, payment.order_id, 'reconciliation_mismatch', SYSTEM_ACTOR, {
      payment_id: payment.id,
      local_status: payment.status,
      provider_status: result.data.status,
      local_amount: Number(payment.amount),
      provider_amount: result.data.amount,
    });
    const { data: order } = await service
      .from('orders')
      .select('tags')
      .eq('id', payment.order_id)
      .maybeSingle();
    await service
      .from('orders')
      .update({ tags: [...new Set([...(order?.tags ?? []), 'reconcile-mismatch'])] })
      .eq('id', payment.order_id);
  }

  await persistRun(service, summary);
  return summary;
}
