import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getContactField } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactFieldForm } from '@/components/admin/ContactFieldForm';

export const dynamic = 'force-dynamic';

export default async function EditContactFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole('viewer');
  const field = await getContactField(id);
  if (!field) notFound();

  return (
    <>
      <AdminHeader title={field.label_he} />
      <ContactFieldForm field={field} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
