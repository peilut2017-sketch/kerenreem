import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { CategoryForm } from '@/components/admin/CategoryForm';

export const dynamic = 'force-dynamic';

export default async function NewCategoryPage() {
  await requireScreenPermission('categories', 'edit');

  return (
    <>
      <AdminHeader title="קטגוריה חדשה" />
      <CategoryForm
        category={null}
        bookCount={0}
        canWrite={true}
      />
    </>
  );
}
