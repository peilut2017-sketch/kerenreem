import { loadNewBookFormData } from '@/lib/admin/book-form-data';
import { BookForm } from '@/components/admin/BookForm';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';

export const dynamic = 'force-dynamic';

export default async function NewBookModal() {
  const data = await loadNewBookFormData();

  return (
    <EntityFormDrawer title="ספר חדש">
      <BookForm {...data} images={[]} toc={[]} previewPages={[]} />
    </EntityFormDrawer>
  );
}
