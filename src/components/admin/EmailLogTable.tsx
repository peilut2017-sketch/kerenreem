import { formatAdminDate } from '@/lib/admin/reporting/format';
import type { EmailLogRow } from '@/lib/admin/email-log-queries';
import { EmailOpenBadge } from './EmailOpenBadge';

/** שם קריא לסוג ההודעה. סוג שאינו ברשימה (תבניות הזמנה) מוצג כפי שהוא. */
const LABELS: Record<string, string> = {
  contact_ack: 'אישור קבלת פנייה',
  contact_staff: 'התראה לצוות על פנייה',
  contact_reply: 'מענה לפנייה',
  inquiry_followup: 'תשובת פונה (התראה לצוות)',
  team_invite: 'הזמנת איש צוות',
  password_reset: 'איפוס סיסמה',
  password_changed: 'הסיסמה הוחלפה',
  plain: 'הודעה חופשית',
  test: 'בדיקה',
  order_confirmation: 'אישור הזמנה',
  order_updated: 'עדכון הזמנה',
  payment_received: 'תשלום התקבל',
  payment_failed: 'תשלום נכשל',
  document_ready: 'מסמך מוכן',
  shipped: 'ההזמנה נשלחה',
  ready_for_pickup: 'מוכנה לאיסוף',
  cancelled: 'ביטול הזמנה',
  refunded: 'זיכוי',
};

/**
 * ‏[1.44] יומן הדואר שנשלח: מי, מה, ומתי נצפה וכמה פעמים. מציג את 100 ההודעות
 * האחרונות; השאר נשמרים במסד.
 */
export function EmailLogTable({ rows }: { rows: EmailLogRow[] }) {
  return (
    <section className="mt-8" aria-labelledby="email-log-heading">
      <h2 id="email-log-heading" className="mb-1 font-serif text-[1.25rem] text-ink">
        דואר שנשלח ומעקב צפייה
      </h2>
      <p className="admin-field-hint mb-3 max-w-[70ch]">
        כל הודעה שהאתר שולח כוללת תמונה שקופה של פיקסל אחד; כשהנמען פותח את ההודעה והתמונה נטענת, נרשמת
        צפייה. המספרים הם <strong>רף תחתון</strong>: מי שחוסם תמונות לא יירשם כלל, ובאפליקציית Mail של
        אפל נרשמות לעיתים צפיות מראש, גם בלי שההודעה נפתחה.
      </p>

      {rows.length === 0 ? (
        <p className="admin-card p-4 text-small text-muted">עדיין לא נשלחו הודעות.</p>
      ) : (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table w-full min-w-[52rem] text-small">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-start">נשלח</th>
                <th scope="col" className="px-4 py-3 text-start">אל</th>
                <th scope="col" className="px-4 py-3 text-start">נושא</th>
                <th scope="col" className="px-4 py-3 text-start">סוג</th>
                <th scope="col" className="px-4 py-3 text-start">צפייה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 tabular-nums text-muted">
                    {formatAdminDate(row.created_at, 'dateTime')}
                  </td>
                  <td dir="ltr" className="px-4 py-2.5 text-start">{row.to_address}</td>
                  <td className="px-4 py-2.5">{row.subject}</td>
                  <td className="px-4 py-2.5 text-muted">{row.label ? (LABELS[row.label] ?? row.label) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <EmailOpenBadge data={row} />
                    {row.status === 'failed' && row.error ? (
                      <span className="mt-1 block text-caption text-muted">{row.error}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
