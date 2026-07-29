import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getActivity } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ActivityForm } from '@/components/admin/ActivityForm';

export const dynamic = 'force-dynamic';

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);
  const activity = await getActivity(id);
  if (!activity) notFound();

  return (
    <>
      <AdminHeader title={activity.title_he} />
      <ActivityForm activity={activity} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
