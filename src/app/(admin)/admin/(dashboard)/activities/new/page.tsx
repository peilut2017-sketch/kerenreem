import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ActivityForm } from '@/components/admin/ActivityForm';

export const dynamic = 'force-dynamic';

export default async function NewActivityPage() {
  const session = await requireRole('editor');
  return (
    <>
      <AdminHeader title="ציר פעילות חדש" />
      <ActivityForm activity={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
