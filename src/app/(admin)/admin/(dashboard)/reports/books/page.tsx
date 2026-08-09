import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { RangePicker } from '@/components/admin/reporting/RangePicker';
import { CsvDownloadButton } from '@/components/admin/reporting/CsvDownloadButton';
import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';
import { getBookEngagementReport, type BookEngagementRow } from '@/lib/admin/reporting/book-engagement-data';
import { rangeFromDays, parseRangeParam } from '@/lib/admin/reporting/date-range';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

const columns: AdminRecordColumn<BookEngagementRow>[] = [
  { key: 'title', header: 'ספר', render: (row) => row.title, cardHidden: true },
  { key: 'views', header: 'צפיות', render: (row) => row.views.toLocaleString('he-IL'), className: 'tabular-nums' },
  {
    key: 'addsToCart',
    header: 'הוספות לסל',
    render: (row) => row.addsToCart.toLocaleString('he-IL'),
    className: 'tabular-nums',
  },
  { key: 'saves', header: 'שמירות', render: (row) => row.saves.toLocaleString('he-IL'), className: 'tabular-nums' },
  {
    key: 'backInStockSubscribers',
    header: 'הודיעו לי כשיחזור',
    render: (row) => row.backInStockSubscribers.toLocaleString('he-IL'),
    className: 'tabular-nums',
  },
  {
    key: 'unitsSold',
    header: 'יחידות שנמכרו',
    render: (row) => row.unitsSold.toLocaleString('he-IL'),
    className: 'tabular-nums',
  },
  {
    key: 'revenue',
    header: 'הכנסה',
    render: (row) => formatPrice(row.revenue, 'he', { alwaysAgorot: true }),
    className: 'tabular-nums',
  },
];

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
              rows={rows}
              filename={`books-engagement-${range.days}d.csv`}
              columns={[
                { label: 'ספר', value: (r) => r.title },
                { label: 'מחיר', value: (r) => r.price ?? '' },
                { label: 'מלאי נוכחי', value: (r) => r.stockQuantity },
                { label: 'צפיות', value: (r) => r.views },
                { label: 'שמירות', value: (r) => r.saves },
                { label: 'הוספות לסל', value: (r) => r.addsToCart },
                { label: 'הודיעו לי כשיחזור', value: (r) => r.backInStockSubscribers },
                { label: 'יחידות שנמכרו', value: (r) => r.unitsSold },
                { label: 'הכנסה', value: (r) => r.revenue.toFixed(2) },
              ]}
            />
          </div>

          <AdminRecordList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.bookId}
            href={(row) => `/admin/books/${row.bookId}`}
            renderCardTitle={(row) => row.title}
            renderCardBadge={(row) => <span className="admin-badge admin-badge-accent">{row.views} צפיות</span>}
            minWidthClassName="min-w-[48rem]"
            emptyMessage="אין נתוני עניין או מכירות בטווח שנבחר."
          />
        </>
      )}
    </>
  );
}
