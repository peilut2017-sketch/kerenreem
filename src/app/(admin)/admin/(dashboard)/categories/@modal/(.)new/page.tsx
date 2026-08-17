import { requireScreenPermission } from '@/lib/admin/auth';
import { CategoryForm } from '@/components/admin/CategoryForm';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';

export const dynamic = 'force-dynamic';

export default async function NewCategoryModal() {
  await requireScreenPermission('categories', 'edit');
  return (
    <EntityFormDrawer title="קטגוריה חדשה" widthClassName="max-w-xl">
      <CategoryForm category={null} bookCount={0} canWrite={true} />
    </EntityFormDrawer>
  );
}
