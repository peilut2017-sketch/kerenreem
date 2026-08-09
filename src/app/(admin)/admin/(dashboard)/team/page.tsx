import { requirePermission } from '@/lib/admin/auth';
import { listProfiles, listScreenOverrides } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { TeamManager } from '@/components/admin/TeamManager';

export const dynamic = 'force-dynamic';

/**
 * ניהול הצוות (מסך 15, פרק 19): שישה תפקידים (כולל store_manager, מודל
 * 1.7), הזמנה במייל עם סיסמה ראשונית, שינוי תפקיד, הרשאה מותאמת אישית
 * פר-מסך (screens.ts) והסרת גישה. מנהל-על בלבד.
 */
export default async function AdminTeamPage() {
  const session = await requirePermission('users');
  const [profiles, overrides] = await Promise.all([listProfiles(), listScreenOverrides()]);

  return (
    <>
      <AdminHeader
        title="צוות והרשאות"
        description="מנהל־על — הכל · מנהל ראשי — הכל מלבד ניהול משתמשים · ניהול תוכן — תוכן בלבד · ניהול חנות (כולל מוכרן/מלקט) — חנות בלבד · לכל משתמש אפשר גם להגדיר הרשאה מותאמת אישית פר-מסך"
      />
      <TeamManager profiles={profiles} currentUserId={session.userId} overrides={overrides} />
    </>
  );
}
