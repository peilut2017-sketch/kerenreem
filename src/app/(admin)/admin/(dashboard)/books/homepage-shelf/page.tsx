import { requireScreenPermission } from '@/lib/admin/auth';
import { getSettings, listBooks } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ShelfBooksPicker } from '@/components/admin/ShelfBooksPicker';

export const dynamic = 'force-dynamic';

/**
 * [1.7] הועבר לכאן, מקבוצת "ספרים", מ-/admin/books/settings (קבוצת
 * "חנות", הייתה גדורה finance): בחירת הספרים למדף בעמוד הבית היא החלטת
 * תוכן — אין לה שום קשר לכסף/משלוח/תשלומים. גדור עכשיו במסך ייעודי
 * משלו (homepage-shelf, screens.ts) — צפייה ועריכה נבדקות שתיהן דרך
 * requireScreenPermission/assertScreenPermission (ראו saveShelfBooks
 * ב-settings-actions.ts), לא דרך editor הגלובלי.
 */
export default async function HomepageShelfPage() {
  await requireScreenPermission('homepage-shelf', 'view');
  const [settings, books] = await Promise.all([getSettings(), listBooks()]);

  // extra יכול להיות null בפועל גם כשהעמודה במסד not null default '{}'.
  const extra = settings?.extra ?? {};
  const shelfBookIds = Array.isArray(extra.shelf_book_ids)
    ? (extra.shelf_book_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];

  return (
    <>
      <AdminHeader
        title="מדף הספרים בעמוד הבית"
        description="בררת המחדל היא הכותרים האחרונים שנוספו. כדי להציג בחירה קבועה במקום זאת, הוסיפו ספרים לרשימה הפעילה וסדרו אותם."
        action={{ href: '/admin/books', label: 'חזרה לספרים', icon: 'back' }}
      />

      {settings ? (
        <ShelfBooksPicker
          books={books.map((book) => ({
            id: book.id,
            title: book.title_he,
            author: book.author?.name_he ?? book.author_name_he ?? null,
            coverUrl: book.cover_image_url,
          }))}
          defaultIds={shelfBookIds}
        />
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}
    </>
  );
}
