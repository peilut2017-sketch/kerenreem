import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getSeries, countBooksBySeries } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { SeriesForm } from '@/components/admin/SeriesForm';

export const dynamic = 'force-dynamic';

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireScreenPermission('series', 'view');
  const canWrite = (await screenAccess(session, 'series')).edit;
  const [series, counts] = await Promise.all([getSeries(id), countBooksBySeries()]);
  if (!series) notFound();

  return (
    <>
      <AdminHeader title={series.name_he} />
      <SeriesForm
        series={series}
        bookCount={counts.get(series.id) ?? 0}
        canWrite={canWrite}
      />
    </>
  );
}
