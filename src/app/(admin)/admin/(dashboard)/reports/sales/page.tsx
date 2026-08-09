import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
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
 * [1.5] מכירות והכנסות — ברוטו/הנחות/משלוח/זיכויים/נטו, פילוח אמצעי
 * תשלום וספרים מובילים לפי הכנסה, עם השוואה אוטומטית לתקופה הקודמת.
 * הנתונים משותפים עם דוח הרווחיות (getSalesData אחד — מקור אמת יחיד).
 */
export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireScreenPermission('reports', 'view');
  const { days: daysParam } = await searchParams;
  const days = parseRangeParam(daysParam);
  const range = rangeFromDays(days);
  const compareRange = previousPeriod(range);

  const [current, previous] = await Promise.all([getSalesData(range), getSalesData(compareRange)]);

  const topByRevenue = [...current.items]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((i) => ({ label: i.title, value: Math.round(i.revenue) }));

  return (
    <>
      <AdminHeader
        title="מכירות והכנסות"
        description="מכירות בלבד — תרומות נספרות בנפרד. אזור זמן: ישראל."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <RangePicker basePath="/admin/reports/sales" days={days} />

      {current.error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              icon="store"
              label="הכנסות ברוטו"
              value={formatPrice(current.gross, 'he', { alwaysAgorot: true })}
              hint={formatDeltaHint(percentChange(current.gross, previous.gross))}
            />
            <StatTile
              icon="analytics"
              label="הכנסות נטו (אחרי זיכויים)"
              value={formatPrice(current.net, 'he', { alwaysAgorot: true })}
              hint={formatDeltaHint(percentChange(current.net, previous.net))}
            />
            <StatTile
              icon="dashboard"
              label="הזמנות ששולמו"
              value={current.paidOrdersCount.toLocaleString('he-IL')}
              hint={formatDeltaHint(percentChange(current.paidOrdersCount, previous.paidOrdersCount))}
            />
            <StatTile
              icon="books"
              label="ערך הזמנה ממוצע"
              value={formatPrice(current.aov, 'he', { alwaysAgorot: true })}
              hint={`${current.units.toLocaleString('he-IL')} יחידות`}
            />
            <StatTile
              icon="coupon"
              label="הנחות שניתנו"
              value={formatPrice(current.discountTotal, 'he', { alwaysAgorot: true })}
            />
            <StatTile
              icon="shipping"
              label="משלוח שנגבה"
              value={formatPrice(current.shippingTotal, 'he', { alwaysAgorot: true })}
            />
            <StatTile
              icon="finance"
              label="זיכויים"
              value={formatPrice(current.refunds, 'he', { alwaysAgorot: true })}
              hint={formatDeltaHint(percentChange(current.refunds, previous.refunds), 'מהתקופה הקודמת')}
            />
            {current.donations > 0 ? (
              <StatTile
                icon="store"
                label="תרומות (בנפרד מהמכירות)"
                value={formatPrice(current.donations, 'he', { alwaysAgorot: true })}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="admin-card px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">אמצעי תשלום</h2>
              <BarList
                items={[...current.methodCounts.entries()].map(([label, value]) => ({ label, value }))}
                emptyLabel="אין עסקאות בטווח."
              />
            </section>

            <section className="admin-card px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-small font-bold text-ink">ספרים מובילים (הכנסה)</h2>
                <CsvDownloadButton
                  rows={[...current.items].sort((a, b) => b.revenue - a.revenue)}
                  filename={`sales-books-${range.days}d.csv`}
                  label="CSV"
                  columns={[
                    { label: 'ספר', value: (r) => r.title },
                    { label: 'יחידות', value: (r) => r.quantity },
                    { label: 'הכנסה', value: (r) => r.revenue.toFixed(2) },
                  ]}
                />
              </div>
              <BarList items={topByRevenue} emptyLabel="אין מכירות בטווח." />
            </section>
          </div>

          <p className="mt-6 text-caption text-muted">
            רוצים לפצל עלות/רווח לפי ספר? עברו ל
            <Link href={`/admin/reports/profitability?days=${days}`} className="text-[var(--admin-accent)] underline">
              {' '}
              דוח הרווחיות
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}
