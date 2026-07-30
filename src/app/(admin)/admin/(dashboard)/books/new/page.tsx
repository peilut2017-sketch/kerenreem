import { requireRole, hasRole } from '@/lib/admin/auth';
import {
  listAuthorsAdmin,
  listCategoriesAdmin,
  listTags,
  listAttributes,
  getSettings,
} from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function NewBookPage() {
  const session = await requireRole('editor');
  const [authors, categories, tags, attributes, settings] = await Promise.all([
    listAuthorsAdmin(),
    listCategoriesAdmin(),
    listTags(),
    listAttributes(),
    getSettings(),
  ]);

  return (
    <>
      <AdminHeader title="ספר חדש" />
      <BookForm
        book={null}
        authors={authors}
        categories={categories}
        tags={tags}
        attributes={attributes}
        relations={{ tagIds: [], categoryIds: [], attributeValueIds: [] }}
        storeEnabled={settings?.store_enabled ?? false}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
