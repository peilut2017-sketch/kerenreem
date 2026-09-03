import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminList';

import { formatAdminDate } from '@/lib/admin/reporting/format';
export const dynamic = 'force-dynamic';

const PROCESSING_STATUS_LABELS: Record<string, string> = {
  received: 'התקבל',
  processed: 'עובד',
  duplicate: 'כפילות',
  invalid_signature: 'חתימה לא תקינה',
  failed: 'נכשל',
};

function formatDateTime(value: string): string {
  return formatAdminDate(value, 'dateTime');
}

/**
 * [1.4] כשלי Webhook היו בלתי נראים לחלוטין: webhook_events.processing_status
 * מקבל failed/invalid_signature, ואפס מסכי UI קראו מהטבלה הזו. חתימה שגויה
 * או כשל עיבוד נבלעו בשקט — בדיוק המסלול שיכול להשאיר הזמנה משולמת בלי
 * מסמך ובלי מייל, בלי שאיש ידע (ראו commerce-ui-implementation-audit.md ז.10).
 * שימוש בשירות (לא ב-RLS הרגיל): webhook_events_admin_read דורש is_admin(),
 * בעוד העמוד פתוח מ-finance — manager לא-super-admin לא ייתקל במסך ריק.
 */
export default async function WebhookFailuresPage() {
  await requireScreenPermission('reports', 'view');
  const service = createServiceClient();

  const { data: events } = service
    ? await service
        .from('webhook_events')
        .select('id, provider, event_type, external_event_id, received_at, processing_status, attempts, error, order_id')
        .in('processing_status', ['failed', 'invalid_signature'])
        .order('received_at', { ascending: false })
        .limit(200)
    : { data: null };

  const rows = events ?? [];

  return (
    <>
      <AdminHeader
        title="כשלי Webhook"
        description="אירועים שהתקבלו ממורנינג ולא עובדו בהצלחה — חתימה לא תקינה או כשל בעיבוד. אירוע שקט כאן יכול להשאיר הזמנה משולמת בלי מסמך ובלי מייל."
        action={{ href: '/admin/reports', label: 'חזרה לדוחות', variant: 'quiet' }}
      />

      {!service ? (
        <p className="text-small text-muted">אין חיבור למסד.</p>
      ) : rows.length === 0 ? (
        <div className="admin-card px-5 py-8 text-center">
          <p className="text-small text-ink">אין כשלי Webhook רשומים. תקין.</p>
        </div>
      ) : (
        <div className="admin-card admin-table-wrap overflow-x-auto">
          <table className="admin-table min-w-[48rem]">
            <thead>
              <tr>
                <th scope="col">התקבל</th>
                <th scope="col">ספק</th>
                <th scope="col">סוג אירוע</th>
                <th scope="col">סטטוס</th>
                <th scope="col">ניסיונות</th>
                <th scope="col">הזמנה</th>
                <th scope="col">שגיאה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => (
                <tr key={event.id}>
                  <td className="tabular-nums">{formatDateTime(event.received_at)}</td>
                  <td>{event.provider}</td>
                  <td dir="ltr" className="text-start">{event.event_type ?? '—'}</td>
                  <td>
                    <span className="admin-badge admin-badge-danger">
                      {PROCESSING_STATUS_LABELS[event.processing_status] ?? event.processing_status}
                    </span>
                  </td>
                  <td className="tabular-nums">{event.attempts}</td>
                  <td>
                    {event.order_id ? (
                      <Link href={`/admin/orders/${event.order_id}`} className="text-[var(--admin-accent)] underline">
                        פתיחה
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="max-w-xs truncate text-caption text-muted" title={event.error ?? undefined}>
                    {event.error ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
