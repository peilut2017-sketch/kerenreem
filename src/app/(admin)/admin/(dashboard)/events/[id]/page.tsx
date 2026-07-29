import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getEvent } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { EventForm } from '@/components/admin/EventForm';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);
  const event = await getEvent(id);
  if (!event) notFound();

  return (
    <>
      <AdminHeader title={event.title_he} />
      <EventForm event={event} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
