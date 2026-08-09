import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { TagForm } from '@/components/admin/TagForm';

export const dynamic = 'force-dynamic';

export default async function NewTagPage() {
  await requireScreenPermission('tags', 'edit');

  return (
    <>
      <AdminHeader title="תגית חדשה" />
      <TagForm tag={null} bookCount={0} canWrite={true} />
    </>
  );
}
