import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { getSalesData } from '@/lib/admin/reporting/sales-data';
import { getAttentionReport } from '@/lib/admin/reporting/attention-data';
import { rangeFromDays, previousPeriod, percentChange } from '@/lib/admin/reporting/date-range';
import { formatDeltaHint } from '@/lib/admin/reporting/format';
import { formatPrice } from '@/lib/commerce/pricing';
import { getStoreSettings } from '@/lib/commerce/settings';
import { FAMILY_ORDER, FAMILY_LABELS, FAMILY_ICONS } from '@/lib/admin/reporting/types';
import { reportsByFamily } from '@/lib/admin/reporting/registry';

export const dynamic = 'force-dynamic';

const DASHBOARD_DAYS = 30;

/**
 * [1.5] מבנה חדש: דשבורד קצר בראש העמוד, ומתחתיו שש המשפחות (האפיון:
 * "לא הייתי שם 26 אפשרויות בתפריט"). כל 26 הדוחות שהוגדרו מופיעים כאן —
 * הבנויים כקישור חי, השאר כ"בקרוב" עם התיאור שלהם, כדי שהמבנה המלא יהיה
 * גלוי מהיום הראשון גם לפני שכל דוח נבנה (registry.ts).
 */
export default async function ReportsIndexPage() {
  await requirePermission('finance');
  const range = rangeFromDays(DASHBOARD_DAYS);
  const compareRange = previousPeriod(range);
  const supabase = await createClient();

  const [sales, previousSales, attention, stockBooksRes, settings] = await Promise.all([
    getSalesData(range),
    getSalesData(compareRange),
    getAttentionReport(),
    supabase
      ? supabase
          .from('books')
          .select('stock_quantity, low_stock_threshold')
          .eq('is_stock_managed', true)
          .eq('is_purchasable', true)
          .limit(3000)
      : Promise.resolve({ data: [] }),
    getStoreSettings(),
  ]);

  const attentionTotal =
    Object.values(attention.counts).reduce((sum, n) => sum + n, 0) + attention.openServiceRequests.length;
  const defaultLowStockThreshold = settings.low_stock_threshold ?? 2;
  const lowStockCount = (stockBooksRes.data ?? []).filter(
    (b) => (b.stock_quantity ?? 0) <= (b.low_stock_threshold ?? defaultLowStockThreshold),
  ).length;

  return (
    <>
      <AdminHeader
        title="דוחות"
        description={`דשבורד קצר ל-${DASHBOARD_DAYS} הימים האחרונים, ומתחתיו כניסה לדוחות המפורטים לפי משפחה. אזור זמן: ישראל.`}
      />

      <div className="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile
          icon="store"
          label="הכנסות ברוטו"
          value={formatPrice(sales.gross, 'he', { alwaysAgorot: true })}
          hint={formatDeltaHint(percentChange(sales.gross, previousSales.gross))}
        />
        <StatTile
          icon="dashboard"
          label="הזמנות ששולמו"
          value={sales.paidOrdersCount.toLocaleString('he-IL')}
          hint={formatDeltaHint(percentChange(sales.paidOrdersCount, previousSales.paidOrdersCount))}
        />
        <StatTile
          icon="books"
          label="ערך הזמנה ממוצע"
          value={formatPrice(sales.aov, 'he', { alwaysAgorot: true })}
          hint={`${sales.units.toLocaleString('he-IL')} יחידות`}
        />
        <StatTile
          icon="inventory"
          label="מלאי נמוך"
          value={lowStockCount.toLocaleString('he-IL')}
          hint={lowStockCount > 0 ? undefined : 'תקין'}
        />
        <Link href="/admin/reports/attention" className="block">
          <StatTile
            icon="coupon"
            label="דורש טיפול עכשיו"
            value={attentionTotal.toLocaleString('he-IL')}
            hint={attentionTotal > 0 ? 'לחצו לפירוט' : 'הכול תקין'}
          />
        </Link>
      </div>

      <div className="space-y-10">
        {FAMILY_ORDER.map((family) => (
          <section key={family} aria-labelledby={`family-${family}`}>
            <h2 id={`family-${family}`} className="mb-4 flex items-center gap-2 font-serif text-h3 text-ink">
              <AdminIcon name={FAMILY_ICONS[family]} className="h-5 w-5 text-muted" />
              {FAMILY_LABELS[family]}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reportsByFamily(family).map((report) =>
                report.href ? (
                  <Link
                    key={report.id}
                    href={report.href}
                    className="admin-card block px-4 py-3.5 transition-colors hover:bg-cream-2/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{report.title}</span>
                      {report.priority === 'critical' ? (
                        <span className="admin-badge admin-badge-warning">קריטי</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-caption text-muted">{report.blurb}</p>
                  </Link>
                ) : (
                  <div key={report.id} className="admin-card px-4 py-3.5 opacity-70">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{report.title}</span>
                      <span className="admin-badge admin-badge-neutral">בקרוב</span>
                    </div>
                    <p className="mt-1 text-caption text-muted">{report.blurb}</p>
                  </div>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
