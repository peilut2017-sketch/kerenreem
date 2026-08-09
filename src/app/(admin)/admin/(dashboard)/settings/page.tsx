import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { getSettings } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  // [1.7] admin → manager: "מנהל ראשי" מוגדר כ"כל ההגדרות, לא כולל הוספת
  // משתמשים" — ראו saveSettings/saveStoreSettings/saveBannersEnabled ב-
  // settings-actions.ts, שירדו לאותה דרגה, וscreens.ts (org-settings אינו
  // ב-ADMIN_ONLY_SCREENS).
  await requireRole('manager');
  const settings = await getSettings();

  return (
    <>
      <AdminHeader title="הגדרות" description="זהות הארגון, פרטי קשר ורשתות." />

      <p className="mb-8 text-caption text-muted">
        הפעלת החנות — תחת{' '}
        <Link href="/admin/books/settings" className="link">
          חנות ← הגדרות חנות
        </Link>
        ; ניהול הצוות והתפקידים עבר למסך{' '}
        <Link href="/admin/team" className="link">
          צוות והרשאות
        </Link>
        .
      </p>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}
    </>
  );
}
