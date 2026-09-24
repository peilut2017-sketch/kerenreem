import { loadEditBookFormData } from '@/lib/admin/book-form-data';
import { getBookImages, getBookPreviewPages, getBookToc } from '@/lib/admin/queries';
import { BookForm } from '@/components/admin/BookForm';
import { EntityFormDrawer } from '@/components/admin/EntityFormDrawer';

export const dynamic = 'force-dynamic';

/**
 * ‏[1.41] מזהי ספרים הם uuid (‎books.id, 01_schema.sql). כל מקטע אחר
 * תחת /admin/books אינו ספר אלא מסך אחיו — homepage-shelf, readiness,
 * sale-prices, settings — ואין ליירט אותו.
 *
 * למה הבדיקה הזו נחוצה: המשבצת המקבילה @modal מכילה ‎(.)[id], מקטע
 * דינמי שתופס **כל** מקטע. בניווט רך אל /admin/books/homepage-shelf
 * המשבצת ניסתה לפתוח את עורך הספרים עבור מזהה "homepage-shelf",
 * ‏loadEditBookFormData קרא ל-notFound() — והמסך כולו החזיר 404 ריק.
 * רענון העמוד "תיקן" את זה רק משום שיירוט מתרחש בניווט רך בלבד, ולכן
 * התקלה נראתה אקראית.
 *
 * בדיקת צורה ולא רשימת מקטעים שמורים במכוון: רשימה כזו הייתה נשכחת
 * בפעם הבאה שמישהו מוסיף מסך תחת /admin/books, וזו בדיוק הדרך שבה
 * התקלה הזו נולדה.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditBookModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // ‏null ולא notFound(): המסך האמיתי מוצג במשבצת children, וכאן רק
  // מוותרים על החלונית. בדיוק מה ש-@modal/default.tsx עושה.
  if (!UUID.test(id)) return null;

  const [data, images, toc, previewPages] = await Promise.all([
    loadEditBookFormData(id),
    getBookImages(id),
    getBookToc(id),
    getBookPreviewPages(id),
  ]);

  return (
    <EntityFormDrawer title={data.book!.title_he}>
      <BookForm {...data} images={images} toc={toc} previewPages={previewPages} />
    </EntityFormDrawer>
  );
}
