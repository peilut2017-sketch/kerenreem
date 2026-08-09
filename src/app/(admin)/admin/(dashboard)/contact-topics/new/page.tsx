import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactTopicForm } from '@/components/admin/ContactTopicForm';

export const dynamic = 'force-dynamic';

export default async function NewContactTopicPage() {
  await requireScreenPermission('contact-topics', 'edit');

  return (
    <>
      <AdminHeader title="תחום פנייה חדש" />
      <ContactTopicForm topic={null} canWrite={true} />
    </>
  );
}
