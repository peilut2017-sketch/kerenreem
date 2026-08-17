import { requireScreenPermission } from '@/lib/admin/auth';
import { getEventMediaViewsByUrl, listStorageFiles } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { MediaLibraryTable, type MediaFileRow } from '@/components/admin/MediaLibraryTable';
import { createClient } from '@/lib/supabase/server';
import { toCdnUrl } from '@/lib/image-src';

export const dynamic = 'force-dynamic';

/**
 * [1.19] ספריית המדיה של האתר — כל הקבצים בחמשת ה-buckets הציבוריים
 * (כריכות, אירועים, דיוקנאות, דפי דוגמה, כללי) במקום אחד: מי העלה,
 * מתי, גודל, והחלפה/מחיקה ישירה. מסך מנהל-על בלבד (ADMIN_ONLY_SCREENS,
 * screens.ts) — הוא חושף מייל מעלה ומאפשר מחיקת קובץ מכל bucket באתר.
 */
export default async function AdminMediaLibraryPage() {
  await requireScreenPermission('media-library', 'view');

  const supabase = await createClient();
  const [files, viewsByUrl] = await Promise.all([listStorageFiles(), getEventMediaViewsByUrl()]);

  const rows: MediaFileRow[] = files.map((file) => {
    const publicUrl =
      supabase?.storage.from(file.bucket_id).getPublicUrl(file.path).data.publicUrl ?? '';
    return {
      ...file,
      publicUrl: toCdnUrl(publicUrl),
      viewCount: file.bucket_id === 'events' ? (viewsByUrl.get(toCdnUrl(publicUrl)) ?? 0) : null,
    };
  });

  return (
    <>
      <AdminHeader
        title="ספריית מדיה"
        description="כל התמונות שהועלו לאחסון האתר — כריכות, תמונות אירועים, דיוקנאות, דפי דוגמה ותמונות כלליות."
      />
      <MediaLibraryTable files={rows} />
    </>
  );
}
