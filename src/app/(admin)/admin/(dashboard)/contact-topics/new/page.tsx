import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactTopicForm } from '@/components/admin/ContactTopicForm';

export const dynamic = 'force-dynamic';

export default async function NewContactTopicPage() {
  const session = await requireRole('editor');

  return (
    <>
      <AdminHeader title="תחום פנייה חדש" />
      <ContactTopicForm topic={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
