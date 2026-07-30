import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import {
  getBook,
  getBookRelations,
  listAuthorsAdmin,
  listCategoriesAdmin,
  listTags,
  listAttributes,
  getSettings,
} from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);

  const [book, authors, categories, tags, attributes, relations, settings] = await Promise.all([
    getBook(id),
    listAuthorsAdmin(),
    listCategoriesAdmin(),
    listTags(),
    listAttributes(),
    getBookRelations(id),
    getSettings(),
  ]);

  if (!book) notFound();

  return (
    <>
      <AdminHeader
        title={book.title_he}
        description={book.is_published ? `מפורסם · /books/${book.slug}` : 'טיוטה'}
      />
      <BookForm
        book={book}
        authors={authors}
        categories={categories}
        tags={tags}
        attributes={attributes}
        relations={relations}
        storeEnabled={settings?.store_enabled ?? false}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
