import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { listEventsAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';
import { formatDate, parseDateOnly } from '@/lib/hebrew-date';

export const dynamic = 'force-dynamic';

export default async function AdminEventsPage() {
  await requireScreenPermission('events', 'view');
  const events = await listEventsAdmin();

  return (
    <>
      <AdminHeader title="אירועים" action={{ href: '/admin/events/new', label: 'אירוע חדש' }} />
      <AdminTable
        columns={['שם האירוע', 'תאריך', 'מצב ופעולות']}
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
              <AdminCell>
                <RowActions
                entity="events"
                id={event.id}
                label={event.title_he}
                published={event.is_published}
              />
              </AdminCell>
            </AdminRow>
          );
        })}
      </AdminTable>
    </>
  );
}
