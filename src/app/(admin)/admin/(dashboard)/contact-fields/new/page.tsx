import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactFieldForm } from '@/components/admin/ContactFieldForm';

export const dynamic = 'force-dynamic';

export default async function NewContactFieldPage() {
  const session = await requireRole('editor');

  return (
    <>
      <AdminHeader title="שדה מותאם חדש" />
      <ContactFieldForm field={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
