import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { PageForm } from '@/components/admin/PageForm';

export const dynamic = 'force-dynamic';

export default async function NewContentPage() {
  await requireScreenPermission('pages', 'edit');
  return (
    <>
      <AdminHeader title="עמוד חדש" />
      <PageForm page={null} canWrite={true} />
    </>
  );
}
