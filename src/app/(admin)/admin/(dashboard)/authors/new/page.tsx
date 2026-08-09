import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { AuthorForm } from '@/components/admin/AuthorForm';

export const dynamic = 'force-dynamic';

export default async function NewAuthorPage() {
  await requireScreenPermission('authors', 'edit');
  return (
    <>
      <AdminHeader title="מחבר חדש" />
      <AuthorForm author={null} bookCount={0} canWrite={true} />
    </>
  );
}
