import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookToc } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';
import { BookImagesEditor } from '@/components/admin/BookImagesEditor';
import { BookTocEditor } from '@/components/admin/BookTocEditor';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, images, toc] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
  ]);

  return (
    <>
      <AdminHeader
        title={data.book!.title_he}
        description={`ספר #${data.book!.catalogue_number} · ${
          data.book!.is_published ? `מפורסם · /books/${data.book!.slug}` : 'טיוטה'
        }`}
      />
      <BookForm {...data} />

      {/* מחוץ לטופס הראשי בכוונה: אלה טבלאות נפרדות משדות הספר, עם שמירה
          משלהן (ראו saveBookImages/saveBookToc) — בתוך אותו <form> היה
          הופך Enter בשדה טקסט כאן לשליחה בטעות של כל טופס הספר. */}
      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">גלריית תמונות</h2>
        <BookImagesEditor bookId={id} images={images} />
      </div>

      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">תוכן עניינים</h2>
        <BookTocEditor bookId={id} entries={toc} />
      </div>
    </>
  );
}
