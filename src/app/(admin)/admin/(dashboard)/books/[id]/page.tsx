import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookPreviewPages, getBookToc } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, images, toc, previewPages] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
    getBookPreviewPages(id),
  ]);

  return (
    <>
      <AdminHeader
        title={data.book!.title_he}
        description={`ספר #${data.book!.catalogue_number} · ${
          data.book!.is_published ? `מפורסם · /books/${data.book!.slug}` : 'טיוטה'
        }`}
      />
      {/* הגלריה, תוכן העניינים ומחולל דפי הדוגמה יושבים היום בלשוניות
          "תמונות" ו"תוכן עניינים" של הכרטיס עצמו, לא כמקטעים נפרדים
          אחריו — ראו BookForm.tsx. */}
      <BookForm {...data} images={images} toc={toc} previewPages={previewPages} />
    </>
  );
}
