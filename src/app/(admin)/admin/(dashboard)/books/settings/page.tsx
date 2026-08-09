import { requirePermission } from '@/lib/admin/auth';
import { getSettings } from '@/lib/admin/queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { isMorningConfigured } from '@/lib/commerce/morning';
import { AdminHeader } from '@/components/admin/AdminList';
import { StoreSettingsForm } from '@/components/admin/StoreSettingsForm';
import { StoreConfigForm } from '@/components/admin/StoreConfigForm';

export const dynamic = 'force-dynamic';

/**
 * הגדרות קטלוג וחנות — עברו לכאן, תחת "ספרים", מעמוד ההגדרות הכללי:
 * הן שייכות לקטלוג ולא לזהות הארגון (ראו סעיף "רכז תחת ספרים" בבקשת
 * העיצוב). הגדרות הארגון (יצירת קשר, רשתות, לוגו) נשארות ב-/admin/settings.
 *
 * [1.7] "מדף הספרים בעמוד הבית" עבר מכאן ל-/admin/books/homepage-shelf
 * (קבוצת "ספרים", לא "חנות"): זו החלטת תוכן, לא הגדרת חנות/כסף — גדירה
 * מאחורי finance מנעה מעורך תוכן לגעת בה אפילו לצפייה.
 */
export default async function BooksSettingsPage() {
  const session = await requirePermission('finance');
  const isAdmin = session.profile.role === 'admin';
  const [settings, storeSettings] = await Promise.all([getSettings(), getStoreSettings()]);

  return (
    <>
      <AdminHeader
        title="הגדרות קטלוג וחנות"
        description="דגלים ומדיניות שחלים על כל הקטלוג — לא הגדרות ספר בודד."
        action={{ href: '/admin/books', label: 'חזרה לספרים', icon: 'back' }}
      />

      {settings ? (
        <div className="space-y-10">
          <StoreSettingsForm settings={settings} isAdmin={isAdmin} />

          <div className="border-t border-rule pt-8">
            <h2 className="mb-1 font-serif text-h3 text-ink">הגדרות החנות</h2>
            <p className="mb-6 text-small text-muted">
              דגלים שכבתיים, משלוח חינם, תשלומים, מסמך חשבונאי, זמני הכנה ואיסוף עצמי — לפי
              מסמכי האפיון תחת docs/commerce.
            </p>
            <StoreConfigForm settings={storeSettings} morningConfigured={isMorningConfigured()} />
          </div>
        </div>
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}
    </>
  );
}
