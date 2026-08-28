import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { getSettings, listCustomFontsAdmin } from '@/lib/admin/queries';
import { EDITOR_FONT_CHOICES } from '@/lib/fonts';
import { AdminHeader } from '@/components/admin/AdminList';
import { FontsManager } from '@/components/admin/FontsManager';
import { SettingsForm } from '@/components/admin/SettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  // [1.7] admin → manager: "מנהל ראשי" מוגדר כ"כל ההגדרות, לא כולל הוספת
  // משתמשים" — ראו saveSettings/toggleStoreEnabled/saveBannersEnabled ב-
  // settings-actions.ts, שירדו לאותה דרגה, וscreens.ts (org-settings אינו
  // ב-ADMIN_ONLY_SCREENS).
  await requireRole('manager');
  const [settings, customFonts] = await Promise.all([getSettings(), listCustomFontsAdmin()]);

  // רשימת הבחירה לגופני ברירת המחדל — כל הגופנים החינמיים המובנים, ואחריהם
  // הגופנים שהותקנו במסך זה (הפעילים בלבד — גופן כבוי אינו מוזרק לאתר).
  const fontChoices = [
    ...EDITOR_FONT_CHOICES,
    ...customFonts
      .filter((font) => font.is_active)
      .map((font) => ({ label: `${font.name} (מותקן)`, value: `var(--font-custom-${font.slug})` })),
  ];

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
        <SettingsForm settings={settings} fontChoices={fontChoices} />
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}

      <div className="mt-10">
        <FontsManager fonts={customFonts} />
      </div>
    </>
  );
}
