import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { BannerForm } from '@/components/admin/BannerForm';

export const dynamic = 'force-dynamic';

export default async function NewBannerPage() {
  const session = await requireRole('editor');
  return (
    <>
      <AdminHeader title="באנר חדש" />
      <BannerForm banner={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
