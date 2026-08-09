import { requireScreenPermission } from '@/lib/admin/auth';
import { listBooks, type BookRow } from '@/lib/admin/queries';
import { getEffectivePrice, formatPrice } from '@/lib/commerce/pricing';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { AdminRecordList, type AdminRecordColumn } from '@/components/admin/AdminRecordList';

export const dynamic = 'force-dynamic';

type SaleStatus = 'active' | 'scheduled' | 'expired' | 'invalid';

interface SaleRow {
  book: BookRow;
  status: SaleStatus;
}

const STATUS_LABELS: Record<SaleStatus, string> = {
  active: 'פעיל',
  scheduled: 'מתוזמן',
  expired: 'פג תוקף',
  invalid: 'לא תקף',
};

const STATUS_BADGE: Record<SaleStatus, string> = {
  active: 'admin-badge-success',
  scheduled: 'admin-badge-accent',
  expired: 'admin-badge-neutral',
  invalid: 'admin-badge-danger',
};

const STATUS_ORDER: Record<SaleStatus, number> = { active: 0, scheduled: 1, expired: 2, invalid: 3 };

/** [1.6] אותו חלון תאריכים בדיוק כמו getEffectivePrice — לא לוגיקה כפולה, רק סיווג הכישלון */
function saleStatus(book: BookRow, onSale: boolean): SaleStatus {
  if (onSale) return 'active';
  const now = Date.now();
  if (book.sale_starts_at && new Date(book.sale_starts_at).getTime() > now) return 'scheduled';
  if (book.sale_ends_at && new Date(book.sale_ends_at).getTime() < now) return 'expired';
  return 'invalid';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeZone: 'Asia/Jerusalem' }).format(
    new Date(value),
  );
}

function StatusBadge({ status }: { status: SaleStatus }) {
  return <span className={`admin-badge ${STATUS_BADGE[status]}`}>{STATUS_LABELS[status]}</span>;
}

const columns: AdminRecordColumn<SaleRow>[] = [
  { key: 'title', header: 'ספר', render: (row) => row.book.title_he, cardHidden: true },
  { key: 'status', header: 'סטטוס', render: (row) => <StatusBadge status={row.status} />, cardHidden: true },
  {
    key: 'price',
    header: 'מחיר רגיל',
    render: (row) => (row.book.price != null ? formatPrice(row.book.price, 'he') : '—'),
  },
  {
    key: 'sale_price',
    header: 'מחיר מבצע',
    render: (row) => (row.book.sale_price != null ? formatPrice(row.book.sale_price, 'he') : '—'),
  },
  { key: 'sale_name', header: 'שם המבצע', render: (row) => row.book.sale_name_he ?? '—' },
  {
    key: 'window',
    header: 'חלון תאריכים',
    render: (row) =>
      row.book.sale_starts_at || row.book.sale_ends_at
        ? `${row.book.sale_starts_at ? formatDate(row.book.sale_starts_at) : '—'} – ${
            row.book.sale_ends_at ? formatDate(row.book.sale_ends_at) : '—'
          }`
        : 'ללא הגבלת זמן',
  },
];

/**
 * [1.6] "מחירי מבצע" כמסך ריכוז (ט.15, ביקורת ג.32) — עד כה מחיר מבצע
 * היה ניתן לעריכה רק ספר-ספר בלשונית "מסחר" בטופס, בלי שום דרך לראות
 * מי כרגע במבצע, מי מתוזמן ומי פג תוקפו בלי לפתוח כל ספר בנפרד. מסך
 * קריאה עם קישור לעריכה — לא בונה מנגנון עריכה מרוכזת חדש.
 */
export default async function SalePricesPage() {
  await requireScreenPermission('sale-prices', 'view');
  const books = await listBooks();

  const rows: SaleRow[] = books
    .filter((book) => book.sale_price != null)
    .map((book) => {
      const price = getEffectivePrice(book);
      return { book, status: saleStatus(book, price?.onSale ?? false) };
    })
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.book.title_he.localeCompare(b.book.title_he, 'he'));

  const activeCount = rows.filter((row) => row.status === 'active').length;
  const scheduledCount = rows.filter((row) => row.status === 'scheduled').length;
  const expiredCount = rows.filter((row) => row.status === 'expired').length;

  return (
    <>
      <AdminHeader
        title="מחירי מבצע"
        description="כל הספרים עם מחיר מבצע מוגדר — פעילים, מתוזמנים ושפג תוקפם. עריכה נעשית בטופס הספר עצמו, בלשונית מסחר."
        action={{ href: '/admin/books', label: 'כל הספרים', variant: 'quiet' }}
      />

      {rows.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center text-small text-muted">
          אין כרגע ספר עם מחיר מבצע מוגדר.
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatTile icon="coupon" label="מבצעים פעילים" value={activeCount.toLocaleString('he-IL')} />
            <StatTile icon="events" label="מתוזמנים" value={scheduledCount.toLocaleString('he-IL')} />
            <StatTile icon="diagnostics" label="פג תוקפם" value={expiredCount.toLocaleString('he-IL')} />
          </div>

          <AdminRecordList
            rows={rows}
            columns={columns}
            getRowKey={(row) => row.book.id}
            href={(row) => `/admin/books/${row.book.id}`}
            renderCardTitle={(row) => row.book.title_he}
            renderCardBadge={(row) => <StatusBadge status={row.status} />}
            minWidthClassName="min-w-[46rem]"
            emptyMessage="אין ספרים עם מחיר מבצע."
          />
        </>
      )}
    </>
  );
}
