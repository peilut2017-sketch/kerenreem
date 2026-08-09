import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ReportDateRange } from './date-range';

/** [1.5] תשלומים — הצלחות/כשלים/Pending לפי אמצעי, וזיכויים, בטווח נבחר. */

export interface PaymentsReport {
  totalAttempts: number;
  succeeded: number;
  failed: number;
  pending: number;
  expired: number;
  successRate: number;
  methodBreakdown: { label: string; value: number }[];
  refundCount: number;
  refundTotal: number;
  error: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  bit: 'ביט',
  credit: 'אשראי',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  manual_external: 'תשלום חיצוני',
};

export async function getPaymentsReport(range: ReportDateRange): Promise<PaymentsReport> {
  const supabase = await createClient();
  const empty: PaymentsReport = {
    totalAttempts: 0,
    succeeded: 0,
    failed: 0,
    pending: 0,
    expired: 0,
    successRate: 0,
    methodBreakdown: [],
    refundCount: 0,
    refundTotal: 0,
    error: true,
  };
  if (!supabase) return empty;

  const { data, error } = await supabase
    .from('payments')
    .select('kind, status, method, amount')
    .gte('created_at', range.from.toISOString())
    .lt('created_at', range.to.toISOString())
    .limit(20000);
  if (error) {
    console.error('[reporting:payments]', error.message);
    return empty;
  }

  const charges = (data ?? []).filter((p) => p.kind === 'charge');
  const refunds = (data ?? []).filter((p) => p.kind === 'refund' && p.status === 'succeeded');

  const succeeded = charges.filter((p) => p.status === 'succeeded').length;
  const failed = charges.filter((p) => p.status === 'failed').length;
  const pending = charges.filter((p) => ['initiated', 'pending'].includes(p.status)).length;
  const expired = charges.filter((p) => p.status === 'expired').length;

  const methodCounts = new Map<string, number>();
  for (const payment of charges) {
    if (payment.status !== 'succeeded') continue;
    const label = METHOD_LABELS[payment.method ?? ''] ?? 'לא ידוע';
    methodCounts.set(label, (methodCounts.get(label) ?? 0) + 1);
  }

  return {
    totalAttempts: charges.length,
    succeeded,
    failed,
    pending,
    expired,
    successRate: charges.length > 0 ? Math.round((succeeded / charges.length) * 100) : 0,
    methodBreakdown: [...methodCounts.entries()].map(([label, value]) => ({ label, value })),
    refundCount: refunds.length,
    refundTotal: refunds.reduce((sum, r) => sum + Number(r.amount), 0),
    error: false,
  };
}
