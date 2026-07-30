import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookToc } from '@/lib/admin/queries';
import { BookForm } from '@/components/admin/BookForm';
import { BookFormDrawer } from '@/components/admin/BookFormDrawer';
import { BookImagesEditor } from '@/components/admin/BookImagesEditor';
import { BookTocEditor } from '@/components/admin/BookTocEditor';

export const dynamic = 'force-dynamic';

export default async function EditBookModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, images, toc] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
  ]);

  return (
    <BookFormDrawer title={data.book!.title_he}>
      <BookForm {...data} />

      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">גלריית תמונות</h2>
        <BookImagesEditor bookId={id} images={images} />
      </div>

      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">תוכן עניינים</h2>
        <BookTocEditor bookId={id} entries={toc} />
      </div>
    </BookFormDrawer>
  );
}
