import { requirePermission } from '@/lib/admin/auth';
import { listProfiles } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { TeamManager } from '@/components/admin/TeamManager';

export const dynamic = 'force-dynamic';

/**
 * ניהול הצוות (מסך 15, פרק 19): חמישה תפקידים, הזמנה במייל עם סיסמה
 * ראשונית, שינוי תפקיד והסרת גישה. מנהל-על בלבד.
 */
export default async function AdminTeamPage() {
  const session = await requirePermission('users');
  const profiles = await listProfiles();

  return (
    <>
      <AdminHeader
        title="צוות והרשאות"
        description="מנהל־על — הכל · מנהל — הכל מלבד ניהול משתמשים · עורך תוכן — תוכן בלבד · מוכרן — חנות בלבד · מלקט — ליקוט וסטטוס אספקה"
      />
      <TeamManager profiles={profiles} currentUserId={session.userId} />
    </>
  );
}
