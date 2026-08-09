import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { CsvDownloadButton } from '@/components/admin/reporting/CsvDownloadButton';
import { getCouponPerformance } from '@/lib/admin/reporting/coupons-data';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, string> = { percent: 'אחוז', fixed: 'סכום קבוע', free_shipping: 'משלוח חינם' };

/** [1.5] ביצועי קופונים — שימושים, הנחה שניתנה, הכנסה מהזמנות ששולמו, AOV. כל הזמן, לא טווח. */
export default async function CouponsReportPage() {
  await requirePermission('finance');
  const { rows, error } = await getCouponPerformance();

  return (
    <>
      <AdminHeader
        title="קופונים ומבצעים"
        description="ביצועי קופונים מצטברים מאז יצירתם. מבצעים אוטומטיים אינם כלולים עדיין — אין להם רישום מימוש פר-הזמנה."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      {error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : rows.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center">
          <p className="text-small text-ink">אין עדיין קופונים.</p>
        </div>
      ) : (
        <section className="admin-card admin-table-wrap overflow-x-auto">
          <div className="flex items-center justify-between gap-2 px-5 pt-4">
            <h2 className="text-small font-bold text-ink">{rows.length} קופונים</h2>
            <CsvDownloadButton
              rows={rows}
              filename="coupon-performance.csv"
              columns={[
                { label: 'קוד', value: (r) => r.code },
                { label: 'סוג', value: (r) => KIND_LABELS[r.kind] ?? r.kind },
                { label: 'פעיל', value: (r) => (r.active ? 'כן' : 'לא') },
                { label: 'שימושים', value: (r) => r.uses },
                { label: 'הנחה שניתנה', value: (r) => r.totalDiscount.toFixed(2) },
                { label: 'הכנסה (הזמנות ששולמו)', value: (r) => r.paidRevenue.toFixed(2) },
                { label: 'AOV', value: (r) => r.aov.toFixed(2) },
              ]}
            />
          </div>
          <table className="admin-table min-w-[48rem]">
            <thead>
              <tr>
                <th scope="col">קוד</th>
                <th scope="col">סוג</th>
                <th scope="col">מצב</th>
                <th scope="col">שימושים</th>
                <th scope="col">הנחה שניתנה</th>
                <th scope="col">הכנסה (הזמנות ששולמו)</th>
                <th scope="col">AOV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td dir="ltr" className="text-start font-mono">{row.code}</td>
                  <td>{KIND_LABELS[row.kind] ?? row.kind}</td>
                  <td>
                    <span className={`admin-badge ${row.active ? 'admin-badge-success' : 'admin-badge-neutral'}`}>
                      {row.active ? 'פעיל' : 'כבוי'}
                    </span>
                  </td>
                  <td className="tabular-nums">{row.uses.toLocaleString('he-IL')}</td>
                  <td className="tabular-nums">{formatPrice(row.totalDiscount, 'he', { alwaysAgorot: true })}</td>
                  <td className="tabular-nums">{formatPrice(row.paidRevenue, 'he', { alwaysAgorot: true })}</td>
                  <td className="tabular-nums">{row.uses > 0 ? formatPrice(row.aov, 'he', { alwaysAgorot: true }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="mt-4 text-caption text-muted">
        לניהול הקופונים עצמם — <Link href="/admin/coupons" className="text-[var(--admin-accent)] underline">עמוד הקופונים</Link>.
      </p>
    </>
  );
}
