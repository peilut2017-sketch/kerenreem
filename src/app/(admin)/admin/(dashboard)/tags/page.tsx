import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listTags, countBooksByTag } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminTagsPage() {
  await requireRole('viewer');
  const [tags, counts] = await Promise.all([listTags(), countBooksByTag()]);

  return (
    <>
      <AdminHeader
        title="תגיות"
        description="נושאים חוצי-קטגוריה. ניתן ליצור תגית גם ישירות מטופס הספר."
        action={{ href: '/admin/tags/new', label: 'תגית חדשה' }}
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
              <RowActions entity="tags" id={tag.id} label={tag.name_he} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
