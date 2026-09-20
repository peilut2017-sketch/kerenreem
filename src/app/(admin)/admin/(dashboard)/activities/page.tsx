import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listActivitiesAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminActivitiesPage() {
  const session = await requireScreenPermission('activities', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'activities');
  const activities = await listActivitiesAdmin();

  return (
    <>
      <AdminHeader
        title="צירי פעילות"
        description="הצירים שבהם פועל המכון, כפי שהם מופיעים בעמוד הבית ובעמוד הפעילות."
        action={canEdit ? { href: '/admin/activities/new', label: 'ציר חדש' } : undefined}
      />
      <AdminTable
        columns={['שם', 'סדר', 'מצב ופעולות']}
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
              {canEdit ? <RowActions
                entity="activities"
                id={activity.id}
                label={activity.title_he}
                published={activity.is_published}
              /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
