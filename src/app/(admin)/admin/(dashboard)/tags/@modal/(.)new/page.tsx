import { requireScreenPermission } from '@/lib/admin/auth';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';
import { TagForm } from '@/components/admin/TagForm';

export const dynamic = 'force-dynamic';

export default async function NewTagModal() {
  await requireScreenPermission('tags', 'edit');
  return (
    <EntityFormDrawer title="תגית חדשה" widthClassName="max-w-xl">
      <TagForm tag={null} bookCount={0} canWrite={true} />
    </EntityFormDrawer>
  );
}
