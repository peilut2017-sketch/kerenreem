import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadEditBookFormData(id);

  return (
    <>
      <AdminHeader
        title={data.book!.title_he}
        description={`ספר #${data.book!.catalogue_number} · ${
          data.book!.is_published ? `מפורסם · /books/${data.book!.slug}` : 'טיוטה'
        }`}
      />
      <BookForm {...data} />
    </>
  );
}
