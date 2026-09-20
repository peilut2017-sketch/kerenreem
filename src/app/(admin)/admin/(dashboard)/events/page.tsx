import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listEventsAdmin, listEventViewCounts } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';
import { formatDate, parseDateOnly } from '@/lib/hebrew-date';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  const session = await requireScreenPermission('events', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'events');
  const [events, viewCounts] = await Promise.all([listEventsAdmin(), listEventViewCounts()]);

  return (
    <>
      <AdminHeader title="אירועים" action={canEdit ? { href: '/admin/events/new', label: 'אירוע חדש' } : undefined} />
      <AdminTable
        columns={['שם האירוע', 'תאריך', 'צפיות', 'מצב ופעולות']}
        empty={events.length === 0 ? 'טרם נוספו אירועים.' : undefined}
      >
        {events.map((event) => {
          const date = parseDateOnly(event.event_date ?? '');
          return (
            <AdminRow key={event.id}>
              <AdminCell>
                <Link href={`/admin/events/${event.id}`} className="font-semibold hover:text-burgundy">
                  {event.title_he}
                </Link>
              </AdminCell>
              <AdminCell className="text-muted">
                {event.event_date_he ? (
                  <span className="block">{event.event_date_he}</span>
                ) : null}
                {date ? formatDate(date, 'he', event.event_date_he ? 'gregorian' : 'both') : '—'}
              </AdminCell>
              <AdminCell className="text-muted tabular-nums">
                {(viewCounts.get(event.slug) ?? 0).toLocaleString('he-IL')}
              </AdminCell>
              <AdminCell>
                {canEdit ? <RowActions
                entity="events"
                id={event.id}
                label={event.title_he}
                published={event.is_published}
              /> : null}
              </AdminCell>
            </AdminRow>
          );
        })}
      </AdminTable>
    </>
  );
}
