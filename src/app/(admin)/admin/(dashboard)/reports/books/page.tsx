import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { RangePicker } from '@/components/admin/reporting/RangePicker';
import { CsvDownloadButton } from '@/components/admin/reporting/CsvDownloadButton';
import { BookEngagementList } from '@/components/admin/reporting/BookEngagementList';
import { getBookEngagementReport } from '@/lib/admin/reporting/book-engagement-data';
import { rangeFromDays, parseRangeParam } from '@/lib/admin/reporting/date-range';

export const dynamic = 'force-dynamic';

/**
 * [1.6] דוח ספרים (ביקורת ט.7) — commerce_events נכתבת עם עשרות אירועים
 * ואף מסך לא קרא ממנה. עונה על "איזה ספר להדפיס שוב": צפיות/שמירות/
 * הוספות-לסל/הרשמות-למלאי לצד יחידות והכנסה בפועל (getSalesData, מקור
 * האמת הקיים) — כדי להבחין בין ספר שאיש לא מסתכל עליו לספר עם ביקוש
 * גבוה שפשוט לא הומר למכירה (או אזל מהמלאי).
 */
export default async function BooksEngagementReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireScreenPermission('reports', 'view');
  const { days: daysParam } = await searchParams;
  const days = parseRangeParam(daysParam);
  const range = rangeFromDays(days);

  const { rows, error } = await getBookEngagementReport(range);

  const totals = rows.reduce(
    (sum, row) => ({
      views: sum.views + row.views,
      addsToCart: sum.addsToCart + row.addsToCart,
      backInStockSubscribers: sum.backInStockSubscribers + row.backInStockSubscribers,
      unitsSold: sum.unitsSold + row.unitsSold,
    }),
    { views: 0, addsToCart: 0, backInStockSubscribers: 0, unitsSold: 0 },
  );

  const wantedNotStocked = rows.filter((row) => row.backInStockSubscribers > 0 && row.stockQuantity <= 0);

  return (
    <>
      <AdminHeader
        title="ספרים ומוצרים"
        description="צפיות, שמירות והוספות לסל לצד יחידות והכנסה בפועל — לא רק מה נמכר, גם מה מעניין לקוחות שעדיין לא קנו."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <RangePicker basePath="/admin/reports/books" days={days} />

      {error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon="view" label="צפיות בספרים" value={totals.views.toLocaleString('he-IL')} />
            <StatTile icon="store" label="הוספות לסל" value={totals.addsToCart.toLocaleString('he-IL')} />
            <StatTile icon="books" label="יחידות שנמכרו" value={totals.unitsSold.toLocaleString('he-IL')} />
            <StatTile
              icon="coupon"
              label="הודיעו לי כשיחזור למלאי"
              value={totals.backInStockSubscribers.toLocaleString('he-IL')}
              hint={wantedNotStocked.length > 0 ? `${wantedNotStocked.length} מהם אזלו כרגע` : undefined}
            />
          </div>

          {wantedNotStocked.length > 0 ? (
            <div className="admin-card mb-6 border-s-2 border-s-[var(--admin-accent)] px-5 py-4">
              <p className="text-small font-semibold text-ink">
                {wantedNotStocked.length.toLocaleString('he-IL')} ספרים אזלו ויש להם הרשמות &quot;הודיעו לי&quot; פעילות
                — מועמדים ראשונים להדפסה חוזרת
              </p>
              <p className="mt-1 text-caption text-muted">
                {wantedNotStocked
                  .slice(0, 5)
                  .map((row) => row.title)
                  .join(' · ')}
                {wantedNotStocked.length > 5 ? ` ועוד ${wantedNotStocked.length - 5}` : ''}
              </p>
            </div>
          ) : null}

          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-caption text-muted">ממוין לפי צפיות, {rows.length.toLocaleString('he-IL')} ספרים בטווח.</p>
            <CsvDownloadButton
              headers={[
                'ספר',
                'מחיר',
                'מלאי נוכחי',
                'צפיות',
                'שמירות',
                'הוספות לסל',
                'הודיעו לי כשיחזור',
                'לחיצות לספק חיצוני',
                'יחידות שנמכרו',
                'הכנסה',
              ]}
              rows={rows.map((r) => [
                r.title,
                r.price ?? '',
                r.stockQuantity,
                r.views,
                r.saves,
                r.addsToCart,
                r.backInStockSubscribers,
                r.externalSupplierClicks,
                r.unitsSold,
                r.revenue.toFixed(2),
              ])}
              filename={`books-engagement-${range.days}d.csv`}
            />
          </div>

          <BookEngagementList rows={rows} />
        </>
      )}
    </>
  );
}
