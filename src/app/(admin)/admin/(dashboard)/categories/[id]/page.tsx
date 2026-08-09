import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getCategory, countBooksByCategory } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { CategoryForm } from '@/components/admin/CategoryForm';

export const dynamic = 'force-dynamic';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireScreenPermission('categories', 'view');
  const canWrite = (await screenAccess(session, 'categories')).edit;
  const [category, counts] = await Promise.all([getCategory(id), countBooksByCategory()]);
  if (!category) notFound();

  return (
    <>
      <AdminHeader title={category.name_he} />
      <CategoryForm
        category={category}
        bookCount={counts.get(category.id) ?? 0}
        canWrite={canWrite}
      />
    </>
  );
}
