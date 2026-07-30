import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { CategoryForm } from '@/components/admin/CategoryForm';

export const dynamic = 'force-dynamic';

export default async function NewCategoryPage() {
  const session = await requireRole('editor');

  return (
    <>
      <AdminHeader title="קטגוריה חדשה" />
      <CategoryForm
        category={null}
        bookCount={0}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
