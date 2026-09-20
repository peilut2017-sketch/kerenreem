import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listTags, countBooksByTag } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminTagsPage() {
  const session = await requireScreenPermission('tags', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'tags');
  const [tags, counts] = await Promise.all([listTags(), countBooksByTag()]);

  return (
    <>
      <AdminHeader
        title="תגיות"
        description="נושאים חוצי-קטגוריה. ניתן ליצור תגית גם ישירות מטופס הספר."
        action={canEdit ? { href: '/admin/tags/new', label: 'תגית חדשה' } : undefined}
      />

      <AdminTable
        columns={['שם', 'מזהה כתובת', 'ספרים', 'סוג', 'פעולות']}
        empty={tags.length === 0 ? 'טרם נוספו תגיות.' : undefined}
      >
        {tags.map((tag) => (
          <AdminRow key={tag.id}>
            <AdminCell>
              <Link href={`/admin/tags/${tag.id}`} className="font-semibold hover:text-burgundy">
                {tag.name_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">{tag.slug}</span>
            </AdminCell>
            <AdminCell className="text-muted tabular-nums">{counts.get(tag.id) ?? 0}</AdminCell>
            <AdminCell className="text-muted">{tag.is_system ? 'מערכת' : 'רגילה'}</AdminCell>
            <AdminCell>
              {canEdit ? <RowActions entity="tags" id={tag.id} label={tag.name_he} /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
