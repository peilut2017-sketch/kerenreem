import { loadNewBookFormData } from '@/lib/admin/book-form-data';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';

export const dynamic = 'force-dynamic';

export default async function NewBookPage() {
  const data = await loadNewBookFormData();

  return (
    <>
      <AdminHeader title="ספר חדש" />
      {/* אין עדיין book_id — הגלריה, תוכן העניינים ודפי הדוגמה נפתחים
          בלשוניות שלהם רק אחרי השמירה הראשונה (ראו BookForm.tsx). */}
      <BookForm {...data} images={[]} toc={[]} previewPages={[]} />
    </>
  );
}
