import Link from 'next/link';
import { requirePermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { isMorningConfigured } from '@/lib/commerce/morning';
import { AdminHeader } from '@/components/admin/AdminList';
import { RunReconciliationButton } from '@/components/admin/reporting/RunReconciliationButton';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

/**
 * [1.5] התאמה מול Morning — אחד משלושת הדוחות שהוגדרו קריטיים ביותר
 * מיום הפתיחה: לכל הזמנה ששולמה צריכה להיות עסקה ומסמך תואמים אצל
 * מורנינג. אין חלון תאריכים על הפערים — אלה בעיות פתוחות עכשיו, לא
 * פעילות בטווח שנבחר (חריג ישן נעלם בשקט אחרת, ודווקא הוא נשכח).
 */
export default async function ReconciliationReportPage() {
  await requirePermission('finance');
  const supabase = await createClient();
  const service = createServiceClient();
  const morningConfigured = isMorningConfigured();

  if (!supabase) {
    return <AdminHeader title="התאמה מול Morning" description="אין חיבור למסד." />;
  }

  const [outstandingRes, webhookFailuresRes, runsRes] = await Promise.all([
    supabase.from('orders').select('id, order_number, payment_state, document_state, tags').limit(5000),
    service
      ? service
          .from('webhook_events')
          .select('id', { count: 'exact', head: true })
          .in('processing_status', ['failed', 'invalid_signature'])
      : Promise.resolve({ count: 0 }),
    service
      ? service.from('reconciliation_runs').select('*').order('ran_at', { ascending: false }).limit(14)
      : Promise.resolve({ data: [] }),
  ]);

  const outstanding = outstandingRes.data ?? [];
  const paidNoDoc = outstanding.filter(
    (o) => o.payment_state === 'paid' && ['not_created', 'pending', 'failed'].includes(o.document_state),
  );
  const amountMismatch = outstanding.filter((o) => (o.tags ?? []).includes('amount-mismatch'));
  const reconcileMismatch = outstanding.filter((o) => (o.tags ?? []).includes('reconcile-mismatch'));
  const webhookFailureCount = webhookFailuresRes.count ?? 0;
  const runs = runsRes.data ?? [];
  const lastRun = runs[0] ?? null;

  return (
    <>
      <AdminHeader
        title="התאמה מול Morning"
        description="לכל הזמנה ששולמה צריכה להיות עסקה ומסמך תואמים אצל מורנינג. אין אישור אוטומטי לפער — ההכרעה תמיד של הצוות."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      {!morningConfigured ? (
        <p role="status" className="admin-card mb-6 border-s-2 border-s-[var(--admin-warning)] px-4 py-3 text-small text-[var(--admin-warning)]">
          ⚠ מורנינג אינה מוגדרת (מפתחות API חסרים) — ההתאמה היומית לא רצה. &ldquo;הכול תקין&rdquo; למטה אינו אמין.
        </p>
      ) : null}

      <section className="admin-card px-5 py-4">
        <ul className="divide-y divide-rule/60">
          <AttentionRow label="תשלום התקבל ללא מסמך חשבונאי" count={paidNoDoc.length} href="/admin/orders?view=doc_missing" />
          <AttentionRow label="פערי סכומים מול מורנינג" count={amountMismatch.length} href="/admin/orders?view=attention" />
          <AttentionRow label="פערי סטטוס/סכום מהתאמה יומית" count={reconcileMismatch.length} href="/admin/orders?view=attention" />
          <AttentionRow label="כשלי Webhook (חתימה/עיבוד)" count={webhookFailureCount} href="/admin/reports/webhooks" />
        </ul>
      </section>

      <section className="admin-card mt-6 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-small font-bold text-ink">הרצות אחרונות</h2>
          <RunReconciliationButton />
        </div>
        {lastRun ? (
          <p className="mb-3 text-caption text-muted">
            אחרונה: {formatDateTime(lastRun.ran_at)}
            {lastRun.skipped ? ' — דולגה (מורנינג לא מוגדרת)' : ` — נבדקו ${lastRun.checked}, ${lastRun.mismatched} פערים, ${lastRun.unreachable} לא הושגו`}
          </p>
        ) : (
          <p className="mb-3 text-caption text-muted">ההתאמה טרם רצה מעולם.</p>
        )}
        {runs.length > 0 ? (
          <div className="admin-table-wrap overflow-x-auto">
            <table className="admin-table min-w-[36rem]">
              <thead>
                <tr>
                  <th scope="col">רצה</th>
                  <th scope="col">נבדקו</th>
                  <th scope="col">תואמים</th>
                  <th scope="col">פערים</th>
                  <th scope="col">לא הושגו</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="tabular-nums">{formatDateTime(run.ran_at)}</td>
                    <td className="tabular-nums">{run.skipped ? '—' : run.checked}</td>
                    <td className="tabular-nums">{run.skipped ? '—' : run.matched}</td>
                    <td className="tabular-nums">
                      {run.mismatched > 0 ? (
                        <span className="admin-badge admin-badge-warning">{run.mismatched}</span>
                      ) : (
                        run.skipped ? '—' : 0
                      )}
                    </td>
                    <td className="tabular-nums">{run.skipped ? '—' : run.unreachable}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}

function AttentionRow({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-small">
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
