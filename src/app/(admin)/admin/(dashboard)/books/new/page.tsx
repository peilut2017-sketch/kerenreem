import { requireRole, hasRole } from '@/lib/admin/auth';
import { listAuthorsAdmin, listCategoriesAdmin, getSettings } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function NewBookPage() {
  const session = await requireRole('editor');
  const [authors, categories, settings] = await Promise.all([
    listAuthorsAdmin(),
    listCategoriesAdmin(),
    getSettings(),
  ]);

  return (
    <>
      <AdminHeader title="ספר חדש" />
      <BookForm
        book={null}
        authors={authors}
        categories={categories}
        storeEnabled={settings?.store_enabled ?? false}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
