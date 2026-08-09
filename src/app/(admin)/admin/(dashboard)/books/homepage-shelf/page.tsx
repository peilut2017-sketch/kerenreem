import { requireRole } from '@/lib/admin/auth';
import { getSettings, listBooks } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ShelfBooksPicker } from '@/components/admin/ShelfBooksPicker';

export const dynamic = 'force-dynamic';

/**
 * [1.7] הועבר לכאן, מקבוצת "ספרים", מ-/admin/books/settings (קבוצת
 * "חנות", גדור finance): בחירת הספרים למדף בעמוד הבית היא החלטת תוכן —
 * אין לה שום קשר לכסף/משלוח/תשלומים — ומגדרת מנעה מעורך תוכן (הרשאת
 * content, לא finance) לגעת בה כלל, גם לצפייה. גדור כמו שאר עמודי
 * הקבוצה (requireRole('viewer')); השמירה בפועל כבר גדורה assertRole('editor')
 * ב-saveShelfBooks (settings-actions.ts) — לא השתנה.
 */
export default async function HomepageShelfPage() {
  await requireRole('viewer');
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
