import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listPagesAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

const REQUIRED_SLUGS = ['terms', 'privacy', 'accessibility'];

export default async function AdminPagesPage() {
  const session = await requireScreenPermission('pages', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'pages');
  const pages = await listPagesAdmin();
  const missing = REQUIRED_SLUGS.filter((slug) => !pages.some((page) => page.slug === slug));

  return (
    <>
      <AdminHeader
        title="עמודי תוכן"
        description="אודות, תרומה, ועמודי החובה החוקיים."
        action={canEdit ? { href: '/admin/pages/new', label: 'עמוד חדש' } : undefined}
      />

      {missing.length > 0 ? (
        <p role="alert" className="mb-6 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small">
          חסרים עמודי חובה: {missing.join(', ')}. יש להריץ את קובץ ה-seed המשפטי או ליצור אותם ידנית.
        </p>
      ) : null}

      <AdminTable
        columns={['כותרת', 'מזהה כתובת', 'עודכן', 'מצב ופעולות']}
        empty={pages.length === 0 ? 'טרם נוספו עמודים.' : undefined}
      >
        {pages.map((page) => (
          <AdminRow key={page.id}>
            <AdminCell>
              <Link href={`/admin/pages/${page.id}`} className="font-semibold hover:text-burgundy">
                {page.title_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">/{page.slug}</span>
            </AdminCell>
            <AdminCell className="text-muted">
              {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(page.updated_at))}
            </AdminCell>
            <AdminCell>
              {canEdit ? <RowActions
                entity="pages"
                id={page.id}
                label={page.title_he}
                published={page.is_published}
              /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
