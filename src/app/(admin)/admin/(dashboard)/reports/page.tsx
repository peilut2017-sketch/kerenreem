import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { BarList } from '@/components/admin/analytics/BarList';
import { formatPrice } from '@/lib/commerce/pricing';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;

/**
 * דוח המסחר (פרק 17): הכנסות ברוטו/נטו, הזמנות, ממוצע, אמצעי תשלום,
 * ספרים מובילים, נטישה — והתאמות: תשלומים בלי מסמך ופערי סכומים.
 * תרומות אינן נכללות בהכנסות המכירה (עיקרון 17.1). היקף הנתונים צפוי
 * קטן (מאות הזמנות) — הצבירה בזיכרון; עם הצמיחה תעבור ל-SQL.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const session = await requirePermission('finance');
  const canViewCosts = hasPermission(session.profile.role, 'costs');
  const { days: daysParam } = await searchParams;
  const days = (RANGES as readonly number[]).includes(Number(daysParam)) ? Number(daysParam) : 30;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const supabase = await createClient();
  if (!supabase) {
    return <AdminHeader title="דוחות" description="אין חיבור למסד." />;
  }

  const [ordersRes, paymentsRes, itemsRes, sessionsRes] = await Promise.all([
    supabase.from('orders').select('*').gte('created_at', since.toISOString()).limit(2000),
    supabase.from('payments').select('*').gte('created_at', since.toISOString()).limit(4000),
    supabase
      .from('order_items')
      .select('order_id, title_snapshot, quantity, line_total, cost_price_snapshot')
      .limit(8000),
    supabase
      .from('checkout_sessions')
      .select('status')
      .gte('created_at', since.toISOString())
      .limit(4000),
  ]);

  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];

  const paidOrders = orders.filter((order) =>
    ['paid', 'partially_refunded', 'refunded'].includes(order.payment_state),
  );
  const paidIds = new Set(paidOrders.map((order) => order.id));
  const items = (itemsRes.data ?? []).filter((item) => paidIds.has(item.order_id));

  const gross = paidOrders.reduce(
    (sum, order) => sum + Number(order.total) - Number(order.donation_amount ?? 0),
    0,
  );
  const donations = paidOrders.reduce((sum, order) => sum + Number(order.donation_amount ?? 0), 0);
  const refunds = payments
    .filter((payment) => payment.kind === 'refund' && payment.status === 'succeeded')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const net = gross - refunds;
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const aov = paidOrders.length > 0 ? gross / paidOrders.length : 0;

  // אמצעי תשלום — מהחיובים שהצליחו
  const methodCounts = new Map<string, number>();
  for (const payment of payments) {
    if (payment.kind !== 'charge' || payment.status !== 'succeeded') continue;
    const label =
      payment.method === 'bit'
        ? 'ביט'
        : payment.method === 'credit'
          ? 'אשראי'
          : payment.method === 'apple_pay'
            ? 'Apple Pay'
            : payment.method === 'google_pay'
              ? 'Google Pay'
              : payment.method === 'manual_external'
                ? 'תשלום חיצוני'
                : 'לא ידוע';
    methodCounts.set(label, (methodCounts.get(label) ?? 0) + 1);
  }

  // ספרים מובילים ביחידות
  const bookUnits = new Map<string, number>();
  for (const item of items) {
    const title = item.title_snapshot ?? 'ללא שם';
    bookUnits.set(title, (bookUnits.get(title) ?? 0) + item.quantity);
  }
  const topBooks = [...bookUnits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // התאמות: שולם בלי מסמך + פערי סכומים
  const paidNoDoc = orders.filter(
    (order) =>
      order.payment_state === 'paid' &&
      ['not_created', 'pending', 'failed'].includes(order.document_state),
  );
  const mismatches = orders.filter((order) => (order.tags ?? []).includes('amount-mismatch'));
  const cancelRequests = orders.filter((order) => (order.tags ?? []).includes('cancel-requested'));

  // נטישה (פרק 15.3 באפיון)
  const funnel = {
    started: sessions.length,
    contact: sessions.filter((s) => s.status !== 'open').length,
    converted: sessions.filter((s) => s.status === 'converted').length,
  };
  const completion = funnel.started > 0 ? Math.round((funnel.converted / funnel.started) * 100) : 0;

  // [1.1] רווחיות (17.14) — מהצילומים בשורות ההזמנה, למנהלים בלבד.
  // פריט ללא עלות מתועדת נספר בנפרד — לא מוצג כרווח מלא.
  const productRevenue = items.reduce((sum, item) => sum + Number(item.line_total ?? 0), 0);
  const costedItems = items.filter((item) => item.cost_price_snapshot != null);
  const cogs = costedItems.reduce(
    (sum, item) => sum + Number(item.cost_price_snapshot) * item.quantity,
    0,
  );
  const uncostedUnits = items
    .filter((item) => item.cost_price_snapshot == null)
    .reduce((sum, item) => sum + item.quantity, 0);
  const grossProfit = productRevenue - cogs;
  const margin = productRevenue > 0 ? Math.round((grossProfit / productRevenue) * 100) : 0;

  // רווח לפי ספר (רק פריטים עם עלות)
  const profitByBook = new Map<string, number>();
  for (const item of costedItems) {
    const title = item.title_snapshot ?? 'ללא שם';
    const profit = Number(item.line_total ?? 0) - Number(item.cost_price_snapshot) * item.quantity;
    profitByBook.set(title, (profitByBook.get(title) ?? 0) + profit);
  }
  const topProfitBooks = [...profitByBook.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value: Math.round(value) }));

  // פער משלוח: מה שנגבה מול העלות בפועל (רק הזמנות שהוזנה בהן עלות)
  const shippedWithActual = paidOrders.filter((order) => order.actual_shipping_cost != null);
  const shippingCharged = shippedWithActual.reduce(
    (sum, order) => sum + Number(order.shipping_total ?? 0),
    0,
  );
  const shippingActual = shippedWithActual.reduce(
    (sum, order) => sum + Number(order.actual_shipping_cost ?? 0),
    0,
  );
  const reconcileMismatches = orders.filter((order) =>
    (order.tags ?? []).includes('reconcile-mismatch'),
  );

  return (
    <>
      <AdminHeader
        title="דוחות מסחר"
        description="מכירות בלבד — תרומות נספרות בנפרד. אזור זמן: ישראל."
      />

      <div className="mb-6 flex gap-2">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/admin/reports?days=${range}`}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-caption ${
              range === days ? 'bg-[var(--admin-accent)] text-white' : 'bg-cream-2 text-ink-soft'
            }`}
          >
            {range} ימים
          </Link>
        ))}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon="store"
          label="הכנסות ברוטו"
          value={formatPrice(gross, 'he', { alwaysAgorot: true })}
        />
        <StatTile
          icon="analytics"
          label="הכנסות נטו (אחרי זיכויים)"
          value={formatPrice(net, 'he', { alwaysAgorot: true })}
          hint={refunds > 0 ? `זיכויים: ${formatPrice(refunds, 'he', { alwaysAgorot: true })}` : undefined}
        />
        <StatTile
          icon="dashboard"
          label="הזמנות ששולמו"
          value={paidOrders.length.toLocaleString('he-IL')}
        />
        <StatTile
          icon="books"
          label="ערך הזמנה ממוצע"
          value={formatPrice(aov, 'he', { alwaysAgorot: true })}
          hint={`${units.toLocaleString('he-IL')} יחידות`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">אמצעי תשלום</h2>
          <BarList
            items={[...methodCounts.entries()].map(([label, value]) => ({ label, value }))}
            emptyLabel="אין עסקאות בטווח."
          />
        </section>

        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">ספרים מובילים (יחידות)</h2>
          <BarList items={topBooks} emptyLabel="אין מכירות בטווח." />
        </section>

        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">התאמות — דורש טיפול</h2>
          <ul className="space-y-2 text-small">
            <ReconRow
              label="תשלום התקבל ללא מסמך חשבונאי"
              count={paidNoDoc.length}
              href="/admin/orders?view=doc_missing"
            />
            <ReconRow
              label="פערי סכומים מול מורנינג"
              count={mismatches.length}
              href="/admin/orders?view=attention"
            />
            <ReconRow
              label="פערי התאמה יומית (reconciliation)"
              count={reconcileMismatches.length}
              href="/admin/orders?view=attention"
            />
            <ReconRow
              label="בקשות ביטול פתוחות"
              count={cancelRequests.length}
              href="/admin/orders?view=cancel_requests"
            />
            {donations > 0 ? (
              <li className="flex justify-between text-muted">
                <span>תרומות (בנפרד מהמכירות)</span>
                <span className="tabular-nums">{formatPrice(donations, 'he', { alwaysAgorot: true })}</span>
              </li>
            ) : null}
          </ul>
        </section>

        <section className="admin-card px-5 py-4">
          <h2 className="mb-3 text-small font-bold text-ink">משפך ההזמנה</h2>
          <BarList
            items={[
              { label: 'התחילו Checkout', value: funnel.started },
              { label: 'הזינו פרטי קשר', value: funnel.contact },
              { label: 'השלימו הזמנה', value: funnel.converted },
            ]}
            emptyLabel="אין נתוני Checkout בטווח."
          />
          <p className="mt-2 text-caption text-muted">שיעור השלמה: {completion}%</p>
        </section>
      </div>

      {/* [1.1] רווחיות (17.14) — מנהל-על ומנהל בלבד; מהצילומים, לא מהעלות הנוכחית */}
      {canViewCosts ? (
        <section aria-labelledby="profit-heading" className="mt-10">
          <h2 id="profit-heading" className="mb-4 font-serif text-h3 text-ink">
            רווחיות
          </h2>
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
              hint={`${margin}% מהכנסות המוצרים`}
            />
            <StatTile
              icon="store"
              label="משלוח שנגבה (בהזמנות עם עלות)"
              value={formatPrice(shippingCharged, 'he', { alwaysAgorot: true })}
            />
            <StatTile
              icon="dashboard"
              label="פער משלוח (נגבה − בפועל)"
              value={formatPrice(shippingCharged - shippingActual, 'he', { alwaysAgorot: true })}
              hint={
                shippedWithActual.length > 0
                  ? `${shippedWithActual.length} הזמנות עם עלות בפועל`
                  : 'טרם הוזנו עלויות משלוח בפועל'
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section className="admin-card px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">רווח גולמי לפי ספר (₪)</h2>
              <BarList
                items={topProfitBooks}
                emptyLabel="אין נתוני עלות בטווח — הזינו עלות ליחידה בעמוד הספר."
              />
            </section>
            <section className="admin-card px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">איך זה מחושב</h2>
              <ul className="space-y-1.5 text-caption text-muted">
                <li>· עלות המכר — מצילום העלות בעת ההזמנה, לא מהעלות הנוכחית.</li>
                <li>· רווח גולמי = הכנסות מוצרים (אחרי הנחות, לפני משלוח) − עלות המכר.</li>
                <li>· פריטים ללא עלות מתועדת נספרים בנפרד ואינם מוצגים כרווח.</li>
                <li>· עמלת סליקה בפועל תתווסף עם נתוני ההתאמה ממורנינג (A8).</li>
                <li>· עלות משלוח בפועל מוזנת בעמוד ההזמנה או בייבוא מחברת המשלוחים.</li>
              </ul>
            </section>
          </div>
        </section>
      ) : null}
    </>
  );
}

function ReconRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className={count > 0 ? 'text-ink' : 'text-muted'}>{label}</span>
      {count > 0 ? (
        <Link href={href} className="admin-badge admin-badge-warning admin-badge-button">
          {count} לטיפול
        </Link>
      ) : (
        <span className="admin-badge admin-badge-success">תקין</span>
      )}
    </li>
  );
}
