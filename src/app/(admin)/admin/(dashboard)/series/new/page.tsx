import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { SeriesForm } from '@/components/admin/SeriesForm';

export const dynamic = 'force-dynamic';

export default async function NewSeriesPage() {
  const session = await requireRole('editor');

  return (
    <>
      <AdminHeader title="סדרה חדשה" />
      <SeriesForm series={null} bookCount={0} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
