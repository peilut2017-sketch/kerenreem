import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listSeriesAdmin, countBooksBySeries } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminSeriesPage() {
  const session = await requireScreenPermission('series', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'series');
  const [series, counts] = await Promise.all([listSeriesAdmin(), countBooksBySeries()]);

  return (
    <>
      <AdminHeader
        title="סדרות"
        description="קבוצות כרכים — שיוך ספר לסדרה נעשה בטופס הספר עצמו."
        action={canEdit ? { href: '/admin/series/new', label: 'סדרה חדשה' } : undefined}
      />

      <AdminTable
        columns={['שם', 'מזהה כתובת', 'ספרים', 'פעולות']}
        empty={series.length === 0 ? 'טרם נוספו סדרות.' : undefined}
      >
        {series.map((item) => (
          <AdminRow key={item.id}>
            <AdminCell>
              <Link href={`/admin/series/${item.id}`} className="font-semibold hover:text-burgundy">
                {item.name_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">{item.slug}</span>
            </AdminCell>
            <AdminCell className="text-muted tabular-nums">{counts.get(item.id) ?? 0}</AdminCell>
            <AdminCell>
              {canEdit ? <RowActions entity="series" id={item.id} label={item.name_he} /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
