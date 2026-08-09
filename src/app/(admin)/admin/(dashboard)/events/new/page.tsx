import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { EventForm } from '@/components/admin/EventForm';

export const dynamic = 'force-dynamic';

export default async function NewEventPage() {
  await requireScreenPermission('events', 'edit');
  return (
    <>
      <AdminHeader title="אירוע חדש" />
      <EventForm event={null} canWrite={true} />
    </>
  );
}
