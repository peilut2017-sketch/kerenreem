import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getCategory, countBooksByCategory } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { CategoryForm } from '@/components/admin/CategoryForm';

export const dynamic = 'force-dynamic';

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole('viewer');
  const [category, counts] = await Promise.all([getCategory(id), countBooksByCategory()]);
  if (!category) notFound();

  return (
    <>
      <AdminHeader title={category.name_he} />
      <CategoryForm
        category={category}
        bookCount={counts.get(category.id) ?? 0}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
