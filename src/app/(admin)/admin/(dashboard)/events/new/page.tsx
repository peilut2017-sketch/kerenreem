import { requireRole, hasRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { EventForm } from '@/components/admin/EventForm';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  const session = await requireRole('editor');
  return (
    <>
      <AdminHeader title="אירוע חדש" />
      <EventForm event={null} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
