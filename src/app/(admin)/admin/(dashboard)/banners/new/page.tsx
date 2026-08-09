import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { BannerForm } from '@/components/admin/BannerForm';

export const dynamic = 'force-dynamic';

export default async function NewBannerPage() {
  await requireScreenPermission('banners', 'edit');
  return (
    <>
      <AdminHeader title="באנר חדש" />
      <BannerForm banner={null} canWrite={true} />
    </>
  );
}
