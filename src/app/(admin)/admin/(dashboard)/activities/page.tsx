import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listActivitiesAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable, PublishBadge } from '@/components/admin/AdminList';

export const dynamic = 'force-dynamic';

export default async function AdminActivitiesPage() {
  await requireRole('viewer');
  const activities = await listActivitiesAdmin();

  return (
    <>
      <AdminHeader
        title="צירי פעילות"
        description="הצירים שבהם פועל המכון, כפי שהם מופיעים בעמוד הבית ובעמוד הפעילות."
        action={{ href: '/admin/activities/new', label: 'ציר חדש' }}
      />
      <AdminTable
        columns={['שם', 'סדר', 'מצב']}
        empty={activities.length === 0 ? 'טרם נוספו צירי פעילות.' : undefined}
      >
        {activities.map((activity) => (
          <AdminRow key={activity.id}>
            <AdminCell>
              <Link href={`/admin/activities/${activity.id}`} className="font-semibold hover:text-burgundy">
                {activity.title_he}
              </Link>
            </AdminCell>
            <AdminCell className="tabular-nums text-muted">{activity.sort_order}</AdminCell>
            <AdminCell>
              <PublishBadge published={activity.is_published} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
