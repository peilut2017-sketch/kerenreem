import { requireScreenPermission } from '@/lib/admin/auth';
import { AuthorForm } from '@/components/admin/AuthorForm';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';

export const dynamic = 'force-dynamic';

export default async function NewAuthorModal() {
  await requireScreenPermission('authors', 'edit');
  return (
    <EntityFormDrawer title="מחבר חדש" widthClassName="max-w-2xl">
      <AuthorForm author={null} bookCount={0} canWrite={true} />
    </EntityFormDrawer>
  );
}
