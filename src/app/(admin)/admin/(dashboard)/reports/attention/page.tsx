import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { savedViewHref } from '@/lib/admin/commerce-queries';
import { getAttentionReport } from '@/lib/admin/reporting/attention-data';

export const dynamic = 'force-dynamic';

const KIND_LABELS: Record<string, string> = { cancel: 'ביטול', return: 'החזרה' };

function formatAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60_000));
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  return `לפני ${days} ימים`;
}

/**
 * [1.5] הזמנות שדורשות טיפול — אחד משלושת הדוחות שהוגדרו קריטיים ביותר
 * מיום הפתיחה. דוח עבודה יומי, לא אנליטיקה בלבד: כל שורה מובילה ישירות
 * לרשימת ההזמנות המסוננת או לבקשת השירות הספציפית.
 */
export default async function AttentionReportPage() {
  await requireScreenPermission('reports', 'view');
  const report = await getAttentionReport();
  const { counts } = report;

  const rows = [
    { label: 'ממתינות לתשלום', count: counts.pendingPayment, href: savedViewHref('pending_payment') },
    { label: 'שולמו — טרם טופלו', count: counts.paidNotActioned, href: savedViewHref('new') },
    {
      label: 'בהכנה מעל 3 ימים',
      count: counts.preparingTooLong,
      href: '/admin/orders?fulfillment=preparing',
    },
    {
      label: 'שולמו ולא נכנסו להכנה מעל 3 ימים',
      count: counts.unfulfilledTooLong,
      href: '/admin/orders?fulfillment=unfulfilled',
    },
    { label: 'שולם — ללא מסמך חשבונאי', count: counts.docMissing, href: savedViewHref('doc_missing') },
    {
      label: 'נשלחו — עברו את תאריך האספקה המובטח',
      count: counts.shippedLate,
      href: '/admin/orders?fulfillment=shipped',
    },
    { label: 'פערי סכומים / התאמה', count: counts.amountOrReconcileMismatch, href: savedViewHref('attention') },
    { label: 'כשלי Webhook', count: counts.webhookFailures, href: '/admin/reports/webhooks' },
    { label: 'מלאי שלילי (תקלת נתונים)', count: counts.negativeStock, href: '/admin/inventory' },
  ];

  const totalAttention = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <>
      <AdminHeader
        title="הזמנות שדורשות טיפול"
        description="דוח עבודה יומי — לא רק אנליטיקה, וגם מסך החריגים המרכזי. אין חלון תאריכים: אלה בעיות פתוחות עכשיו, גם אם ישנות."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      {report.error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : totalAttention === 0 && report.openServiceRequests.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center">
          <p className="text-small text-ink">אין כרגע הזמנות שדורשות טיפול. תקין.</p>
        </div>
      ) : (
        <>
          <section className="admin-card px-5 py-4">
            <ul className="divide-y divide-rule/60">
              {rows.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-small">
                  <span className={row.count > 0 ? 'text-ink' : 'text-muted'}>{row.label}</span>
                  {row.count > 0 ? (
                    <Link href={row.href} className="admin-badge admin-badge-warning admin-badge-button">
                      {row.count} לטיפול
                    </Link>
                  ) : (
                    <span className="admin-badge admin-badge-success">תקין</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {report.openServiceRequests.length > 0 ? (
            <section className="admin-card mt-6 px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">
                בקשות שירות פתוחות ({report.openServiceRequests.length})
              </h2>
              <ul className="divide-y divide-rule/60">
                {report.openServiceRequests.map((req) => (
                  <li key={req.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-small">
                    <span>
                      <Link href={`/admin/orders/${req.orderId}`} className="font-semibold text-[var(--admin-accent)] underline">
                        #{req.orderNumber}
                      </Link>
                      <span className="ms-2 text-ink">{KIND_LABELS[req.kind] ?? req.kind}</span>
                      <span className="ms-1.5 text-caption text-muted">
                        · {req.requestedBy === 'customer' ? 'ע״י הלקוח' : 'ע״י הצוות'}
                      </span>
                    </span>
                    <span className="text-caption text-muted">{formatAge(req.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
