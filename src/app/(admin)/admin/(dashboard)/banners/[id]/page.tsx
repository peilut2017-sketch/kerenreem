import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getBanner } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BannerForm } from '@/components/admin/BannerForm';

export const dynamic = 'force-dynamic';

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);
  const banner = await getBanner(id);
  if (!banner) notFound();

  return (
    <>
      <AdminHeader title={banner.title_he} description={banner.is_published ? 'מוצג באתר' : 'מוסתר'} />
      <BannerForm banner={banner} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
