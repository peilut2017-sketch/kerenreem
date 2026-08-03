import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookPreviewPages, getBookToc } from '@/lib/admin/queries';
import { BookForm } from '@/components/admin/BookForm';
import { BookFormDrawer } from '@/components/admin/BookFormDrawer';

export const dynamic = 'force-dynamic';

export default async function EditBookModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, images, toc, previewPages] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
    getBookPreviewPages(id),
  ]);

  return (
    <BookFormDrawer title={data.book!.title_he}>
      <BookForm {...data} images={images} toc={toc} previewPages={previewPages} />
    </BookFormDrawer>
  );
}
