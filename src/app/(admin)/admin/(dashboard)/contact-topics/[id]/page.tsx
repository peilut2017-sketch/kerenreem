import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getContactTopic } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactTopicForm } from '@/components/admin/ContactTopicForm';

export const dynamic = 'force-dynamic';

export default async function EditContactTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireScreenPermission('contact-topics', 'view');
  const canWrite = (await screenAccess(session, 'contact-topics')).edit;
  const topic = await getContactTopic(id);
  if (!topic) notFound();

  return (
    <>
      <AdminHeader title={topic.name_he} />
      <ContactTopicForm topic={topic} canWrite={canWrite} />
    </>
  );
}
