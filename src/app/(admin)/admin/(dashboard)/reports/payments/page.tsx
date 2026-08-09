import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { BarList } from '@/components/admin/analytics/BarList';
import { RangePicker } from '@/components/admin/reporting/RangePicker';
import { getPaymentsReport } from '@/lib/admin/reporting/payments-data';
import { rangeFromDays, parseRangeParam } from '@/lib/admin/reporting/date-range';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

/** [1.5] תשלומים — הצלחות/כשלים/Pending לפי אמצעי, וזיכויים. */
export default async function PaymentsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireScreenPermission('reports', 'view');
  const { days: daysParam } = await searchParams;
  const days = parseRangeParam(daysParam);
  const range = rangeFromDays(days);
  const report = await getPaymentsReport(range);

  return (
    <>
      <AdminHeader
        title="תשלומים"
        description="ניסיונות חיוב לפי אמצעי ותוצאה, וזיכויים שבוצעו — לא כולל תשלום חיצוני שסומן ידנית."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <RangePicker basePath="/admin/reports/payments" days={days} />

      {report.error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatTile icon="dashboard" label="ניסיונות חיוב" value={report.totalAttempts.toLocaleString('he-IL')} />
            <StatTile icon="store" label="הצליחו" value={report.succeeded.toLocaleString('he-IL')} hint={`${report.successRate}% הצלחה`} />
            <StatTile icon="coupon" label="נכשלו" value={report.failed.toLocaleString('he-IL')} />
            <StatTile icon="analytics" label="ממתינים / פגי תוקף" value={(report.pending + report.expired).toLocaleString('he-IL')} />
            <StatTile icon="finance" label="זיכויים" value={`${formatPrice(report.refundTotal, 'he', { alwaysAgorot: true })}`} hint={`${report.refundCount} זיכויים`} />
          </div>

          <section className="admin-card px-5 py-4">
            <h2 className="mb-3 text-small font-bold text-ink">אמצעי תשלום (עסקאות שהצליחו)</h2>
            <BarList items={report.methodBreakdown} emptyLabel="אין עסקאות שהצליחו בטווח." />
          </section>
        </>
      )}
    </>
  );
}
