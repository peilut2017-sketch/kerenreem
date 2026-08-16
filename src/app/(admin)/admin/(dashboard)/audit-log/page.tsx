import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_TABLE_LABELS,
  listAuditActors,
  listAuditLog,
} from '@/lib/admin/audit-log-queries';

export const dynamic = 'force-dynamic';

const ACTION_BADGE: Record<string, string> = {
  insert: 'admin-badge-success',
  update: 'admin-badge-neutral',
  delete: 'admin-badge-danger',
  login: 'admin-badge-accent',
  upload: 'admin-badge-accent',
  reorder: 'admin-badge-neutral',
  reply: 'admin-badge-success',
  status: 'admin-badge-neutral',
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function diffFields(oldValues: Record<string, unknown> | null, newValues: Record<string, unknown> | null): string[] {
  if (!oldValues && !newValues) return [];
  const keys = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
  const changes: string[] = [];
  for (const key of keys) {
    const before = oldValues?.[key];
    const after = newValues?.[key];
    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    changes.push(`${key}: ${before === undefined ? '—' : JSON.stringify(before)} ← ${after === undefined ? '—' : JSON.stringify(after)}`);
  }
  return changes;
}

/**
 * [1.6] יומן ביקורת (ביקורת ג.37/ט.5) — מנהל-על בלבד, תואם ל-RLS
 * (audit_admin_read: is_admin()) כדי שלא יוצג מסך שה-RLS חוסם אותו בשקט.
 */
export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    table?: string;
    page?: string;
    action?: string;
    user?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  await requireRole('admin');
  const params = await searchParams;
  const filter = {
    tableName: params.table,
    page: params.page,
    action: params.action,
    userId: params.user,
    q: params.q,
    sort: params.sort,
  };
  const [result, actors] = await Promise.all([listAuditLog(filter), listAuditActors()]);
  const { rows, page, pageSize, total, error } = result;
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  const pageHref = (targetPage: number) => {
    const query = new URLSearchParams();
    if (params.table) query.set('table', params.table);
    if (params.action) query.set('action', params.action);
    if (params.user) query.set('user', params.user);
    if (params.q) query.set('q', params.q);
    if (params.sort) query.set('sort', params.sort);
    if (targetPage > 1) query.set('page', String(targetPage));
    const qs = query.toString();
    return qs ? `/admin/audit-log?${qs}` : '/admin/audit-log';
  };

  return (
    <>
      <AdminHeader
        title="יומן ביקורת"
        description="כל פעולה שנשמרה בפאנל הניהול — מי, מתי, מהות הפעולה ופירוט השינוי: כניסות למערכת, הוספה ועריכה של ספרים ותוכן, שינוי הגדרות והעלאת קבצים. גישה למנהל-על בלבד."
      />

      <form method="get" action="/admin/audit-log" className="mb-5 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="audit-q" className="mb-1 block text-caption text-muted">
            חיפוש חופשי
          </label>
          <input
            id="audit-q"
            type="search"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="חיפוש בתיאור הפעולה"
            className="admin-field-input w-56"
          />
        </div>
        <div>
          <label htmlFor="audit-action" className="mb-1 block text-caption text-muted">
            סוג פעולה
          </label>
          <select id="audit-action" name="action" defaultValue={params.action ?? ''} className="admin-field-input w-40">
            <option value="">הכל</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-user" className="mb-1 block text-caption text-muted">
            מבצע
          </label>
          <select id="audit-user" name="user" defaultValue={params.user ?? ''} className="admin-field-input w-44">
            <option value="">הכל</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-table" className="mb-1 block text-caption text-muted">
            תחום
          </label>
          <select id="audit-table" name="table" defaultValue={params.table ?? ''} className="admin-field-input w-44">
            <option value="">הכל</option>
            {Object.entries(AUDIT_TABLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="audit-sort" className="mb-1 block text-caption text-muted">
            מיון
          </label>
          <select id="audit-sort" name="sort" defaultValue={params.sort ?? ''} className="admin-field-input w-36">
            <option value="">מהחדש לישן</option>
            <option value="asc">מהישן לחדש</option>
          </select>
        </div>
        <button type="submit" className="admin-btn admin-btn-quiet">
          סינון
        </button>
        {params.table || params.action || params.user || params.q || params.sort ? (
          <Link href="/admin/audit-log" className="admin-btn admin-btn-ghost">
            איפוס
          </Link>
        ) : null}
      </form>

      {error ? (
        <div role="alert" className="admin-card px-6 py-10 text-center text-small text-[var(--admin-danger)]">
          שגיאה בטעינת יומן הביקורת.
        </div>
      ) : rows.length === 0 ? (
        <div className="admin-card px-6 py-10 text-center text-small text-muted">אין רשומות תואמות.</div>
      ) : (
        <div className="admin-card admin-table-wrap">
          <table className="admin-table w-full min-w-[52rem] text-small">
            <thead>
              <tr>
                <th scope="col" className="px-4 py-3 text-start">תאריך</th>
                <th scope="col" className="px-4 py-3 text-start">מי</th>
                <th scope="col" className="px-4 py-3 text-start">פעולה</th>
                <th scope="col" className="px-4 py-3 text-start">טבלה</th>
                <th scope="col" className="px-4 py-3 text-start">שינוי</th>
                <th scope="col" className="px-4 py-3 text-start">הקשר</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const changes = diffFields(row.oldValues, row.newValues);
                return (
                  <tr key={row.id} className="border-b border-rule/60">
                    <td className="px-4 py-2.5 tabular-nums text-muted">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {row.userName ?? '—'}
                      {row.actorType !== 'staff' ? (
                        <span className="ms-1.5 text-caption text-muted">({row.actorType})</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`admin-badge ${ACTION_BADGE[row.action] ?? 'admin-badge-neutral'}`}>
                        {AUDIT_ACTION_LABELS[row.action] ?? row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {AUDIT_TABLE_LABELS[row.tableName] ?? row.tableName}
                      {row.tableName === 'orders' && row.recordId ? (
                        <Link href={`/admin/orders/${row.recordId}`} className="ms-2 text-caption text-[var(--admin-accent)] underline">
                          פתיחה
                        </Link>
                      ) : row.tableName === 'books' && row.recordId ? (
                        <Link href={`/admin/books/${row.recordId}`} className="ms-2 text-caption text-[var(--admin-accent)] underline">
                          פתיחה
                        </Link>
                      ) : null}
                    </td>
                    <td className="max-w-xs px-4 py-2.5 text-caption text-ink-soft">
                      {changes.length > 0 ? (
                        <ul dir="ltr" className="space-y-0.5 text-start">
                          {changes.slice(0, 4).map((line) => (
                            <li key={line} className="truncate" title={line}>
                              {line}
                            </li>
                          ))}
                          {changes.length > 4 ? <li>+{changes.length - 4} נוספים</li> : null}
                        </ul>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-caption text-muted">{row.context ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!error && (total == null || total > pageSize || page > 1) ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-small">
          <span className="text-caption text-muted">
            {total != null
              ? `עמוד ${page} מתוך ${totalPages} · ${total.toLocaleString('he-IL')} רשומות`
              : `עמוד ${page} · לא ניתן לספור את הסך הכול`}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="admin-btn admin-btn-quiet">
                הקודם
              </Link>
            ) : null}
            {rows.length === pageSize && (totalPages == null || page < totalPages) ? (
              <Link href={pageHref(page + 1)} className="admin-btn admin-btn-quiet">
                הבא
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
