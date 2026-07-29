import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { PageForm } from '@/components/admin/PageForm';

export const dynamic = 'force-dynamic';

export default async function NewContentPage() {
  const session = await requireRole('editor');
  return (
    <>
      <AdminHeader title="עמוד חדש" />
      <PageForm page={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
