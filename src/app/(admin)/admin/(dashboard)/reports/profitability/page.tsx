import { requirePermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { BarList } from '@/components/admin/analytics/BarList';
import { RangePicker } from '@/components/admin/reporting/RangePicker';
import { CsvDownloadButton } from '@/components/admin/reporting/CsvDownloadButton';
import { getSalesData } from '@/lib/admin/reporting/sales-data';
import { rangeFromDays, previousPeriod, parseRangeParam, percentChange } from '@/lib/admin/reporting/date-range';
import { formatDeltaHint } from '@/lib/admin/reporting/format';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

/**
 * [1.5] רווחיות — הכנסות פחות עלות המכר (מהצילום בעת ההזמנה, לא מהעלות
 * הנוכחית), לפי ספר. אותו מקור נתונים כמו דוח המכירות (getSalesData),
 * כדי ששני הדוחות תמיד יסכימו על יחידות והכנסות. costs בלבד — לא finance.
 */
export default async function ProfitabilityReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requirePermission('costs');
  const { days: daysParam } = await searchParams;
  const days = parseRangeParam(daysParam);
  const range = rangeFromDays(days);
  const compareRange = previousPeriod(range);

  const [current, previous] = await Promise.all([getSalesData(range), getSalesData(compareRange)]);

  const productRevenue = current.items.reduce((sum, i) => sum + i.revenue, 0);
  const cogs = current.items.reduce((sum, i) => sum + i.cost, 0);
  const uncostedUnits = current.items.reduce((sum, i) => sum + (i.quantity - i.costedQuantity), 0);
  const grossProfit = productRevenue - cogs;
  const margin = productRevenue > 0 ? Math.round((grossProfit / productRevenue) * 100) : 0;

  const prevProductRevenue = previous.items.reduce((sum, i) => sum + i.revenue, 0);
  const prevCogs = previous.items.reduce((sum, i) => sum + i.cost, 0);
  const prevGrossProfit = prevProductRevenue - prevCogs;

  const profitByBook = [...current.items]
    .filter((i) => i.costedQuantity > 0)
    .map((i) => ({ label: i.title, value: Math.round(i.revenue - i.cost) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return (
    <>
      <AdminHeader
        title="רווחיות"
        description="עלות המכר מהצילום בעת ההזמנה — לא מהעלות הנוכחית בכרטיס הספר. פריט ללא עלות מתועדת נספר בנפרד."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <RangePicker basePath="/admin/reports/profitability" days={days} />

      {current.error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon="finance"
              label="עלות המכר (COGS)"
              value={formatPrice(cogs, 'he', { alwaysAgorot: true })}
              hint={uncostedUnits > 0 ? `${uncostedUnits} יחידות ללא עלות מתועדת` : undefined}
            />
            <StatTile
              icon="analytics"
              label="רווח גולמי"
              value={formatPrice(grossProfit, 'he', { alwaysAgorot: true })}
              hint={formatDeltaHint(percentChange(grossProfit, prevGrossProfit))}
            />
            <StatTile icon="dashboard" label="אחוז רווח" value={`${margin}%`} hint="מהכנסות המוצרים" />
            <StatTile
              icon="books"
              label="הכנסות מוצרים (אחרי הנחות, לפני משלוח)"
              value={formatPrice(productRevenue, 'he', { alwaysAgorot: true })}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="admin-card px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-small font-bold text-ink">רווח גולמי לפי ספר (₪)</h2>
                <CsvDownloadButton
                  rows={current.items.filter((i) => i.costedQuantity > 0)}
                  filename={`profitability-${range.days}d.csv`}
                  label="CSV"
                  columns={[
                    { label: 'ספר', value: (r) => r.title },
                    { label: 'יחידות', value: (r) => r.quantity },
                    { label: 'הכנסה', value: (r) => r.revenue.toFixed(2) },
                    { label: 'עלות', value: (r) => r.cost.toFixed(2) },
                    { label: 'רווח גולמי', value: (r) => (r.revenue - r.cost).toFixed(2) },
                  ]}
                />
              </div>
              <BarList items={profitByBook} emptyLabel="אין נתוני עלות בטווח — הזינו עלות ליחידה בעמוד הספר." />
            </section>

            <section className="admin-card px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">איך זה מחושב</h2>
              <ul className="space-y-1.5 text-caption text-muted">
                <li>· עלות המכר — מצילום העלות בעת ההזמנה, לא מהעלות הנוכחית.</li>
                <li>· רווח גולמי = הכנסות מוצרים (אחרי הנחות, לפני משלוח) − עלות המכר.</li>
                <li>· פריטים ללא עלות מתועדת נספרים בנפרד ואינם מוצגים כרווח.</li>
                <li>· קיבוץ לפי הספר עצמו (book_id), לא לפי שם — שם שתוקן לא מפצל את הספר לשתי שורות.</li>
                <li>· עמלת סליקה בפועל ועלות משלוח בפועל אינן נכללות כאן עדיין (דוח משלוחים נפרד).</li>
              </ul>
            </section>
          </div>
        </>
      )}
    </>
  );
}
