import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listCategoriesAdmin, countBooksByCategory } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  await requireRole('viewer');
  const [categories, counts] = await Promise.all([listCategoriesAdmin(), countBooksByCategory()]);

  return (
    <>
      <AdminHeader
        title="קטגוריות"
        description="חלוקת הקטלוג. כל קטגוריה היא אפשרות בטופס הספר ומסנן בעמוד הספרים."
        action={{ href: '/admin/categories/new', label: 'קטגוריה חדשה' }}
      />

      <AdminTable
        columns={['שם', 'מזהה כתובת', 'ספרים', 'סדר', 'פעולות']}
        empty={categories.length === 0 ? 'טרם נוספו קטגוריות.' : undefined}
      >
        {categories.map((category) => (
          <AdminRow key={category.id}>
            <AdminCell>
              <Link
                href={`/admin/categories/${category.id}`}
                className="font-semibold hover:text-burgundy"
              >
                {category.name_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">{category.slug}</span>
            </AdminCell>
            <AdminCell className="text-muted tabular-nums">
              {counts.get(category.id) ?? 0}
            </AdminCell>
            <AdminCell className="text-muted tabular-nums">{category.sort_order ?? '—'}</AdminCell>
            <AdminCell>
              <RowActions entity="categories" id={category.id} label={category.name_he} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
