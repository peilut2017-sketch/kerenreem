import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { SeriesForm } from '@/components/admin/SeriesForm';

export const dynamic = 'force-dynamic';

export default async function NewSeriesPage() {
  await requireScreenPermission('series', 'edit');

  return (
    <>
      <AdminHeader title="סדרה חדשה" />
      <SeriesForm series={null} bookCount={0} canWrite={true} />
    </>
  );
}
