import { requireRole } from '@/lib/admin/auth';
import { getSettings } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { StoreSettingsForm } from '@/components/admin/StoreSettingsForm';

export const dynamic = 'force-dynamic';

/**
 * הגדרות קטלוג וחנות — מקובצות תחת "ספרים" בתפריט הניווט (ראו AdminNav),
 * אבל חיות בכתובת עצמאית ולא מקוננות תחת /admin/books/. הגדרות הארגון
 * (יצירת קשר, רשתות, לוגו) נשארות ב-/admin/settings.
 *
 * לא /admin/books/settings בכוונה: books/ מכיל @modal עם (.)[id] שמיירט
 * ניווט צד-לקוח — וכשעמוד ליטרלי כמו "settings" יושב באותה רמה כמו
 * [id], ה-router של Next (Turbopack, 16.2.12) מזהה בטעות בזמן ניווט רך
 * (קליק על Link) את "settings" כערך של [id] ופותח את המגירה של עריכת
 * ספר במקום לרנדר את העמוד הליטרלי — גם כשקיים לו interceptor מפורש
 * משלו תחת @modal/(.)settings. אושש בבדיקה מבודדת עם page.tsx זמני
 * שהראה בבירור שה-slot של children נשאר תקוע על העמוד הקודם. כתובת
 * עצמאית מחוץ לתיקיית books/ עוקפת את הבעיה לגמרי.
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
