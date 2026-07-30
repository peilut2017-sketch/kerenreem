import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { AuthorForm } from '@/components/admin/AuthorForm';

export const dynamic = 'force-dynamic';

export default async function NewAuthorPage() {
  const session = await requireRole('editor');
  return (
    <>
      <AdminHeader title="מחבר חדש" />
      <AuthorForm author={null} bookCount={0} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
