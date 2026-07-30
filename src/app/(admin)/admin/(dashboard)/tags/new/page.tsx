import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { TagForm } from '@/components/admin/TagForm';

export const dynamic = 'force-dynamic';

export default async function NewTagPage() {
  const session = await requireRole('editor');

  return (
    <>
      <AdminHeader title="תגית חדשה" />
      <TagForm tag={null} bookCount={0} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
