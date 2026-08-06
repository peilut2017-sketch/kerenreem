import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookPreviewPages, getBookToc } from '@/lib/admin/queries';
import { getAdminSession } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { createServiceClient } from '@/lib/supabase/service';
import { AdminHeader } from '@/components/admin/AdminList';
import { BookForm } from '@/components/admin/BookForm';
import { BookCostPanel } from '@/components/admin/BookCostPanel';

export const dynamic = 'force-dynamic';

export default async function EditBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, images, toc, previewPages, session] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
    getBookPreviewPages(id),
    getAdminSession(),
  ]);

  // [1.1] העלות נטענת רק למי שמורשה לראותה (book_costs פרטית — מודל 3.18)
  const canViewCosts = session ? hasPermission(session.profile.role, 'costs') : false;
  let initialCost: number | null = null;
  if (canViewCosts) {
    const service = createServiceClient();
    if (service) {
      const { data: costRow } = await service
        .from('book_costs')
        .select('cost_price')
        .eq('book_id', id)
        .maybeSingle();
      initialCost = costRow ? Number(costRow.cost_price) : null;
    }
  }

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
      {canViewCosts ? <BookCostPanel bookId={id} initialCost={initialCost} /> : null}
    </>
  );
}
