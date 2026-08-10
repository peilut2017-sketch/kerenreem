import { requireRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { AccountSettingsForm } from '@/components/admin/AccountSettingsForm';

export const dynamic = 'force-dynamic';

/**
 * [1.8] "החשבון שלי": שינוי מייל/סיסמה עצמי לכל איש צוות מחובר (לא רק
 * מנהל-על), ויעד הנחיתה אחרי קישור שחזור הסיסמה מהמייל (?reset=1) —
 * ראו /api/auth/admin-callback.
 */
export default async function AdminAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const session = await requireRole('viewer');
  const { reset } = await searchParams;

  return (
    <>
      <AdminHeader title="החשבון שלי" description="כתובת המייל והסיסמה של חשבון הצוות שלכם." />
      <AccountSettingsForm email={session.email} isPasswordReset={reset === '1'} />
    </>
  );
}
