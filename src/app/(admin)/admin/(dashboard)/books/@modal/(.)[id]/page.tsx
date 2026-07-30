import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { BookForm } from '@/components/admin/BookForm';
import { BookFormDrawer } from '@/components/admin/BookFormDrawer';

export const dynamic = 'force-dynamic';

export default async function EditBookModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadEditBookFormData(id);

  return (
    <BookFormDrawer title={data.book!.title_he}>
      <BookForm {...data} />
    </BookFormDrawer>
  );
}
