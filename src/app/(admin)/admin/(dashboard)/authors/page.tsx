import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listAuthorsAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminAuthorsPage() {
  const session = await requireScreenPermission('authors', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'authors');
  const authors = await listAuthorsAdmin();

  return (
    <>
      <AdminHeader
        title="מחברים ודמויות"
        action={canEdit ? { href: '/admin/authors/new', label: 'מחבר חדש' } : undefined}
      />
      <AdminTable
        columns={['#', 'שם', 'שנים', 'מצב ופעולות']}
        empty={authors.length === 0 ? 'טרם נוספו מחברים.' : undefined}
      >
        {authors.map((author) => (
          <AdminRow key={author.id}>
            <AdminCell className="text-muted tabular-nums">{author.catalogue_number}</AdminCell>
            <AdminCell>
              <Link href={`/admin/authors/${author.id}`} className="font-semibold hover:text-burgundy">
                {author.name_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              {[author.birth_year, author.death_year].filter(Boolean).join('–') || '—'}
            </AdminCell>
            <AdminCell>
              {canEdit ? <RowActions
                entity="authors"
                id={author.id}
                label={author.name_he}
                published={author.is_published}
              /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
