import { requirePermission } from '@/lib/admin/auth';
import { getSettings, listBooks } from '@/lib/admin/queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { AdminHeader } from '@/components/admin/AdminList';
import { StoreSettingsForm } from '@/components/admin/StoreSettingsForm';
import { StoreConfigForm } from '@/components/admin/StoreConfigForm';
import { ShelfBooksPicker } from '@/components/admin/ShelfBooksPicker';

export const dynamic = 'force-dynamic';

/**
 * הגדרות קטלוג וחנות — עברו לכאן, תחת "ספרים", מעמוד ההגדרות הכללי:
 * הן שייכות לקטלוג ולא לזהות הארגון (ראו סעיף "רכז תחת ספרים" בבקשת
 * העיצוב). הגדרות הארגון (יצירת קשר, רשתות, לוגו) נשארות ב-/admin/settings.
 */
export default async function BooksSettingsPage() {
  await requirePermission('finance');
  const [settings, storeSettings, books] = await Promise.all([
    getSettings(),
    getStoreSettings(),
    listBooks(),
  ]);
  // extra יכול להיות null בפועל גם שהעמודה במסד not null default '{}':
  // שורה ישנה יכולה עדיין להחזיק ערך null. נפילה חזרה ל-{} כאן ולא ?.
  // חוזר על כל שימוש — גישה ישירה ל-extra.X בלי הבדיקה קרסה את כל העמוד.
  const extra = settings?.extra ?? {};
  const shelfBookIds = Array.isArray(extra.shelf_book_ids)
    ? (extra.shelf_book_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];

  return (
    <>
      <AdminHeader
        title="הגדרות קטלוג וחנות"
        description="דגלים ומדיניות שחלים על כל הקטלוג — לא הגדרות ספר בודד."
        action={{ href: '/admin/books', label: 'חזרה לספרים', icon: 'back' }}
      />

      {settings ? (
        <div className="space-y-10">
          <StoreSettingsForm settings={settings} />

          <div className="border-t border-rule pt-8">
            <h2 className="mb-1 font-serif text-h3 text-ink">הגדרות החנות</h2>
            <p className="mb-6 text-small text-muted">
              דגלים שכבתיים, משלוח חינם, תשלומים, מסמך חשבונאי, זמני הכנה ואיסוף עצמי — לפי
              מסמכי האפיון תחת docs/commerce.
            </p>
            <StoreConfigForm settings={storeSettings} />
          </div>

          <div className="border-t border-rule pt-8">
            <h2 className="mb-1 font-serif text-h3 text-ink">מדף הספרים בעמוד הבית</h2>
            <p className="mb-6 text-small text-muted">
              בררת המחדל היא הכותרים האחרונים שנוספו. כדי להציג בחירה קבועה במקום זאת, הוסיפו ספרים לרשימה
              הפעילה וסדרו אותם.
            </p>
            <ShelfBooksPicker
              books={books.map((book) => ({
                id: book.id,
                title: book.title_he,
                author: book.author?.name_he ?? book.author_name_he ?? null,
                coverUrl: book.cover_image_url,
              }))}
              defaultIds={shelfBookIds}
            />
          </div>
        </div>
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}
    </>
  );
}
