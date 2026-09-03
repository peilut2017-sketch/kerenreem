import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { listCategoriesAdmin, countBooksByCategory } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const session = await requireScreenPermission('categories', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'categories');
  const [categories, counts] = await Promise.all([listCategoriesAdmin(), countBooksByCategory()]);

  return (
    <>
      <AdminHeader
        title="קטגוריות"
        description="חלוקת הקטלוג. כל קטגוריה היא אפשרות בטופס הספר ומסנן בעמוד הספרים."
        action={canEdit ? { href: '/admin/categories/new', label: 'קטגוריה חדשה' } : undefined}
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
              {canEdit ? <RowActions entity="categories" id={category.id} label={category.name_he} /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
