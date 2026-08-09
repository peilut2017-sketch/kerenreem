import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { DOC_TYPE_LABELS } from '@/components/admin/orders/labels';
import { getDocumentsReport } from '@/lib/admin/reporting/documents-data';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

/** [1.5] מסמכים חשבונאיים — סטטוס הפקה מול מורנינג, לפי סוג, ורשימת כשלים לטיפול. */
export default async function DocumentsReportPage() {
  await requirePermission('finance');
  const report = await getDocumentsReport();

  const totalFailed = report.byType.reduce((sum, t) => sum + t.failed, 0);
  const totalCreated = report.byType.reduce((sum, t) => sum + t.created, 0);

  return (
    <>
      <AdminHeader
        title="מסמכים חשבונאיים"
        description="סטטוס הפקת המסמכים מול מורנינג — לא תוכן המסמך עצמו (מורנינג היא מקור האמת לכך)."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      {report.error ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          אין חיבור למסד.
        </p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
            <StatTile icon="pages" label="הופקו" value={totalCreated.toLocaleString('he-IL')} />
            <StatTile icon="dashboard" label="ממתינים" value={report.totalPending.toLocaleString('he-IL')} />
            <StatTile
              icon="coupon"
              label="נכשלו"
              value={totalFailed.toLocaleString('he-IL')}
              hint={totalFailed > 0 ? 'דורש טיפול' : 'תקין'}
            />
          </div>

          <section className="admin-card admin-table-wrap mb-6 overflow-x-auto">
            <table className="admin-table min-w-[36rem]">
              <thead>
                <tr>
                  <th scope="col">סוג מסמך</th>
                  <th scope="col">הופקו</th>
                  <th scope="col">ממתינים</th>
                  <th scope="col">נכשלו</th>
                </tr>
              </thead>
              <tbody>
                {report.byType.map((row) => (
                  <tr key={row.docType}>
                    <td>{DOC_TYPE_LABELS[row.docType] ?? row.docType}</td>
                    <td className="tabular-nums">{row.created}</td>
                    <td className="tabular-nums">{row.pending}</td>
                    <td className="tabular-nums">
                      {row.failed > 0 ? <span className="admin-badge admin-badge-warning">{row.failed}</span> : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {report.failed.length > 0 ? (
            <section className="admin-card px-5 py-4">
              <h2 className="mb-3 text-small font-bold text-ink">מסמכים שנכשלו ({report.failed.length})</h2>
              <ul className="divide-y divide-rule/60">
                {report.failed.map((doc) => (
                  <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-small">
                    <span>
                      <Link href={`/admin/orders/${doc.orderId}`} className="font-semibold text-[var(--admin-accent)] underline">
                        #{doc.orderNumber}
                      </Link>
                      <span className="ms-2 text-ink">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</span>
                      {doc.error ? <span className="ms-2 text-caption text-muted" title={doc.error}>{doc.error}</span> : null}
                    </span>
                    <span className="text-caption text-muted">
                      {doc.attempts} ניסיונות · {formatDateTime(doc.lastAttemptAt)}
                    </span>
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
