import { loadNewBookFormData } from '@/lib/admin/book-form-data';
import { BookForm } from '@/components/admin/BookForm';
import { BookFormDrawer } from '@/components/admin/BookFormDrawer';

export const dynamic = 'force-dynamic';

export default async function NewBookModal() {
  const data = await loadNewBookFormData();

  return (
    <BookFormDrawer title="ספר חדש">
      <BookForm {...data} images={[]} toc={[]} previewPages={[]} />
    </BookFormDrawer>
  );
}
