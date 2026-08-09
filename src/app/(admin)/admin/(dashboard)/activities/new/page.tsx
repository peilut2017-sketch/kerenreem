import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ActivityForm } from '@/components/admin/ActivityForm';

export const dynamic = 'force-dynamic';

export default async function NewActivityPage() {
  await requireScreenPermission('activities', 'edit');
  return (
    <>
      <AdminHeader title="ציר פעילות חדש" />
      <ActivityForm activity={null} canWrite={true} />
    </>
  );
}
