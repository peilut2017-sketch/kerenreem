import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getSeries, countBooksBySeries, listSeriesBooksMap } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { SeriesForm } from '@/components/admin/SeriesForm';
import { SeriesOrderList } from '@/components/admin/SeriesOrderList';

export const dynamic = 'force-dynamic';

export default async function EditSeriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireScreenPermission('series', 'view');
  const canWrite = (await screenAccess(session, 'series')).edit;
  const [series, counts, seriesBooksMap] = await Promise.all([
    getSeries(id),
    countBooksBySeries(),
    listSeriesBooksMap(),
  ]);
  if (!series) notFound();

  return (
    <>
      <AdminHeader title={series.name_he} />
      <SeriesForm
        series={series}
        bookCount={counts.get(series.id) ?? 0}
        canWrite={canWrite}
      />
      {canWrite && (counts.get(series.id) ?? 0) > 0 ? (
        <div className="admin-card mt-6 p-6">
          <h2 className="mb-1 text-small font-bold text-ink">סדר הכרכים בסדרה</h2>
          <p className="mb-4 text-caption text-muted">
            גררו לסידור מחדש. שיוך ספר לסדרה נעשה בטופס הספר עצמו, לא כאן.
          </p>
          <SeriesOrderList
            seriesId={series.id}
            books={(seriesBooksMap.get(series.id) ?? []).map((book) => ({
              id: book.id,
              title: book.title_he,
              coverUrl: book.cover_image_url,
            }))}
          />
        </div>
      ) : null}
    </>
  );
}
