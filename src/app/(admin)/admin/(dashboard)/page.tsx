import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { createClient } from '@/lib/supabase/server';
import {
  getDashboardCounts,
  listDraftBooks,
  listRecentBooks,
  listUpcomingEvents,
} from '@/lib/admin/queries';
import { savedViewHref } from '@/lib/admin/commerce-queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { formatPrice } from '@/lib/commerce/pricing';
import { AdminHeader, PublishBadge } from '@/components/admin/AdminList';
import { AdminIcon, type AdminIconName } from '@/components/admin/AdminIcons';
import { formatDate, parseDateOnly } from '@/lib/hebrew-date';

export const dynamic = 'force-dynamic';

/** [1.4] תחילת "היום" בזמן ישראל (כולל שעון קיץ), כ-ISO ב-UTC. */
function startOfTodayIsraelIso(): string {
  const now = new Date();
  const israelWallClock = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
  const offsetMs = now.getTime() - israelWallClock.getTime();
  israelWallClock.setHours(0, 0, 0, 0);
  return new Date(israelWallClock.getTime() + offsetMs).toISOString();
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const [session, { denied }] = await Promise.all([requireRole('viewer'), searchParams]);

  // חמש שאילתות מצומצמות במקביל, במקום שליפה של הקטלוג ולוח האירועים כולם.
  const [counts, recent, drafts, upcoming] = await Promise.all([
    getDashboardCounts(),
    listRecentBooks(),
    listDraftBooks(),
    listUpcomingEvents(),
  ]);

  // [1.3] פילוח הזמנות בדשבורד — לבעלי הרשאת חנות בלבד
  const storeStats: { label: string; value: number; href: string; icon: AdminIconName }[] = [];
  if (hasPermission(session.profile.role, 'store_view')) {
    const supabase = await createClient();
    if (supabase) {
      const count = (query: PromiseLike<{ count: number | null }>) =>
        query.then((r) => r.count ?? 0);
      const [total, confirmed, pendingPay, preparing, attention] = await Promise.all([
        count(supabase.from('orders').select('id', { count: 'exact', head: true })),
        count(supabase.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'confirmed')),
        count(
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('payment_state', 'pending')
            .eq('state', 'pending'),
        ),
        count(supabase.from('orders').select('id', { count: 'exact', head: true }).eq('fulfillment_state', 'preparing')),
        count(supabase.from('orders').select('id', { count: 'exact', head: true }).eq('state', 'cancel_pending_refund')),
      ]);
      // [1.4] הקישורים היו מצביעים ל-?view=X בלי פרמטר הסינון הנלווה —
      // listOrders מטפל רק בשלושה מתוך שמונת ה-view-ים (doc_missing/
      // cancel_requests/attention), כך שהמונים האלה הובילו לרשימה לא
      // מסוננת (המונה אומר 3, המסך מציג 100). savedViewHref בונה את
      // הקישור המלא מאותו מקור שממנו חושב המספר, כך שהשניים תמיד יתאימו.
      storeStats.push(
        { label: 'סה״כ הזמנות', value: total, href: '/admin/orders', icon: 'orders' },
        { label: 'חדשות לטיפול', value: confirmed, href: savedViewHref('new'), icon: 'store' },
        { label: 'ממתינות לתשלום', value: pendingPay, href: savedViewHref('pending_payment'), icon: 'finance' },
        { label: 'בליקוט ואריזה', value: preparing, href: savedViewHref('preparing'), icon: 'inventory' },
        { label: 'ממתינות לזיכוי', value: attention, href: '/admin/orders?state=cancel_pending_refund', icon: 'coupon' },
      );
    }
  }

  // [1.4] "דשבורד ריק מתוכן" — בלי הכנסות, בלי "היום", בלי מלאי נמוך
  // ובלי "דורש טיפול" מרוכז. סכומים — למי שרואה כספים (finance) בלבד,
  // באותה רוח שבה נגישות ל-PII וסכומים גודרה בעמוד ההזמנה למלקט.
  const financeStats: { label: string; value: string; href: string; icon: AdminIconName }[] = [];
  if (hasPermission(session.profile.role, 'finance')) {
    const supabase = await createClient();
    if (supabase) {
      const todayIso = startOfTodayIsraelIso();
      const count = (query: PromiseLike<{ count: number | null }>) => query.then((r) => r.count ?? 0);
      const [todayOrders, revenueRows, catalogBooks, storeSettings, paidNoDoc, attentionTagged] = await Promise.all([
        count(supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', todayIso)),
        supabase
          .from('orders')
          .select('total, donation_amount')
          .gte('created_at', todayIso)
          .in('payment_state', ['paid', 'partially_refunded', 'refunded']),
        supabase
          .from('books')
          .select('id, stock_quantity, low_stock_threshold')
          .eq('is_stock_managed', true)
          .eq('is_purchasable', true)
          .limit(3000),
        getStoreSettings(),
        count(
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('payment_state', 'paid')
            .in('document_state', ['not_created', 'pending', 'failed']),
        ),
        count(
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .overlaps('tags', ['amount-mismatch', 'reconcile-mismatch', 'cancel-requested']),
        ),
      ]);
      const revenueToday = (revenueRows.data ?? []).reduce(
        (sum, order) => sum + Number(order.total) - Number(order.donation_amount ?? 0),
        0,
      );
      const defaultThreshold = storeSettings.low_stock_threshold ?? 2;
      const lowStockCount = (catalogBooks.data ?? []).filter(
        (book) => (book.stock_quantity ?? 0) <= (book.low_stock_threshold ?? defaultThreshold),
      ).length;
      const needsAttention = paidNoDoc + attentionTagged;

      financeStats.push(
        { label: 'הזמנות היום', value: todayOrders.toLocaleString('he-IL'), href: '/admin/reports', icon: 'dashboard' },
        {
          label: 'הכנסות היום',
          value: formatPrice(revenueToday, 'he', { alwaysAgorot: true }),
          href: '/admin/reports',
          icon: 'finance',
        },
        { label: 'מלאי נמוך', value: lowStockCount.toLocaleString('he-IL'), href: '/admin/inventory', icon: 'inventory' },
        {
          label: 'דורש טיפול',
          value: needsAttention.toLocaleString('he-IL'),
          href: '/admin/reports',
          icon: 'coupon',
        },
      );
    }
  }

  const stats: { label: string; value: number; href: string; icon: AdminIconName }[] = [
    { label: 'ספרים בקטלוג', value: counts.books, href: '/admin/books', icon: 'books' },
    { label: 'טיוטות', value: counts.drafts, href: '/admin/books', icon: 'edit' },
    { label: 'מחברים', value: counts.authors, href: '/admin/authors', icon: 'authors' },
    { label: 'אירועים', value: counts.events, href: '/admin/events', icon: 'events' },
    { label: 'פניות שלא טופלו', value: counts.messages, href: '/admin/messages', icon: 'messages' },
  ];

  return (
    <>
      <AdminHeader title={`שלום, ${session.profile.full_name || 'עורך'}`} />

      {denied ? (
        <p
          role="alert"
          className="admin-card mb-8 border-s-2 border-s-[var(--admin-danger)] px-4 py-3 text-small"
        >
          אין לך הרשאה לאזור שביקשת.
        </p>
      ) : null}

      {storeStats.length > 0 ? (
        <section aria-label="הזמנות" className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-small font-bold text-ink">
            <AdminIcon name="store" className="h-4 w-4 text-muted" />
            החנות עכשיו
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {storeStats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="admin-stat">
                <span className="admin-icon-chip h-11 w-11">
                  <AdminIcon name={stat.icon} className="h-5 w-5" />
                </span>
                <span>
                  <dt className="text-caption text-muted">{stat.label}</dt>
                  <dd className="mt-0.5 font-serif text-h3 tabular-nums text-ink">{stat.value}</dd>
                </span>
              </Link>
            ))}
          </dl>
        </section>
      ) : null}

      {financeStats.length > 0 ? (
        <section aria-label="כספים ותפעול" className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 text-small font-bold text-ink">
            <AdminIcon name="finance" className="h-4 w-4 text-muted" />
            היום ודורש טיפול
          </h2>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {financeStats.map((stat) => (
              <Link key={stat.label} href={stat.href} className="admin-stat">
                <span className="admin-icon-chip h-11 w-11">
                  <AdminIcon name={stat.icon} className="h-5 w-5" />
                </span>
                <span>
                  <dt className="text-caption text-muted">{stat.label}</dt>
                  <dd className="mt-0.5 font-serif text-h3 tabular-nums text-ink">{stat.value}</dd>
                </span>
              </Link>
            ))}
          </dl>
        </section>
      ) : null}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="admin-stat">
            <span className="admin-icon-chip h-11 w-11">
              <AdminIcon name={stat.icon} className="h-5 w-5" />
            </span>
            <span>
              <dt className="text-caption text-muted">{stat.label}</dt>
              <dd className="mt-0.5 font-serif text-h3 tabular-nums text-ink">{stat.value}</dd>
            </span>
          </Link>
        ))}
      </dl>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="dash-drafts" className="admin-card p-6">
          <h2 id="dash-drafts" className="mb-4 flex items-center gap-2 text-small font-bold text-ink">
            <AdminIcon name="edit" className="h-4 w-4 text-muted" />
            טיוטות ממתינות
          </h2>
          {drafts.length === 0 ? (
            <p className="text-small text-muted">אין טיוטות פתוחות.</p>
          ) : (
            <ul className="space-y-1">
              {drafts.map((book) => (
                <li key={book.id}>
                  <Link
                    href={`/admin/books/${book.id}`}
                    className="flex items-center justify-between gap-4 rounded-[var(--admin-radius-btn)] px-2.5 py-2.5 text-small transition-colors hover:bg-cream-2"
                  >
                    {book.title_he}
                    <PublishBadge published={book.is_published} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-recent" className="admin-card p-6">
          <h2 id="dash-recent" className="mb-4 flex items-center gap-2 text-small font-bold text-ink">
            <AdminIcon name="books" className="h-4 w-4 text-muted" />
            נערכו לאחרונה
          </h2>
          {recent.length === 0 ? (
            <p className="text-small text-muted">טרם נוספו ספרים.</p>
          ) : (
            <ul className="space-y-1">
              {recent.map((book) => (
                <li key={book.id}>
                  <Link
                    href={`/admin/books/${book.id}`}
                    className="flex items-center justify-between gap-4 rounded-[var(--admin-radius-btn)] px-2.5 py-2.5 text-small transition-colors hover:bg-cream-2"
                  >
                    {book.title_he}
                    <span className="shrink-0 text-caption text-muted">
                      {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(
                        new Date(book.updated_at),
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="dash-events" className="admin-card p-6 lg:col-span-2">
          <h2 id="dash-events" className="mb-4 flex items-center gap-2 text-small font-bold text-ink">
            <AdminIcon name="events" className="h-4 w-4 text-muted" />
            אירועים קרובים
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-small text-muted">אין אירועים קרובים.</p>
          ) : (
            <ul className="grid gap-1 sm:grid-cols-2">
              {upcoming.map((event) => {
                const date = parseDateOnly(event.event_date ?? '');
                return (
                  <li key={event.id}>
                    <Link
                      href={`/admin/events/${event.id}`}
                      className="block rounded-[var(--admin-radius-btn)] px-2.5 py-2.5 text-small transition-colors hover:bg-cream-2"
                    >
                      {event.title_he}
                      {date ? (
                        <span className="mt-0.5 block text-caption text-muted">
                          {formatDate(date, 'he', 'both')}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
