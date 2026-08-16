import { requireScreenPermission } from '@/lib/admin/auth';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';
import { SeriesForm } from '@/components/admin/SeriesForm';

export const dynamic = 'force-dynamic';

export default async function NewSeriesModal() {
  await requireScreenPermission('series', 'edit');
  return (
    <EntityFormDrawer title="סדרה חדשה" widthClassName="max-w-xl">
      <SeriesForm series={null} bookCount={0} canWrite={true} />
    </EntityFormDrawer>
  );
}
