import { requireRole } from '@/lib/admin/auth';
import { getSettings } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { StoreSettingsForm } from '@/components/admin/StoreSettingsForm';

export const dynamic = 'force-dynamic';

/**
 * הגדרות קטלוג וחנות — עברו לכאן, תחת "ספרים", מעמוד ההגדרות הכללי:
 * הן שייכות לקטלוג ולא לזהות הארגון (ראו סעיף "רכז תחת ספרים" בבקשת
 * העיצוב). הגדרות הארגון (יצירת קשר, רשתות, לוגו) נשארות ב-/admin/settings.
 */
export default async function BooksSettingsPage() {
  await requireRole('admin');
  const settings = await getSettings();

  return (
    <>
      <AdminHeader
        title="הגדרות קטלוג וחנות"
        description="דגלים ומדיניות שחלים על כל הקטלוג — לא הגדרות ספר בודד."
        action={{ href: '/admin/books', label: 'חזרה לספרים', icon: 'back' }}
      />

      {settings ? (
        <StoreSettingsForm settings={settings} />
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}
    </>
  );
}
