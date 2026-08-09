import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getContactField } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactFieldForm } from '@/components/admin/ContactFieldForm';

export const dynamic = 'force-dynamic';

export default async function EditContactFieldPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireScreenPermission('contact-fields', 'view');
  const canWrite = (await screenAccess(session, 'contact-fields')).edit;
  const field = await getContactField(id);
  if (!field) notFound();

  return (
    <>
      <AdminHeader title={field.label_he} />
      <ContactFieldForm field={field} canWrite={canWrite} />
    </>
  );
}
