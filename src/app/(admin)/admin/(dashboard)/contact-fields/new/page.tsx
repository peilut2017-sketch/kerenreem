import { requireScreenPermission } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { ContactFieldForm } from '@/components/admin/ContactFieldForm';

export const dynamic = 'force-dynamic';

export default async function NewContactFieldPage() {
  await requireScreenPermission('contact-fields', 'edit');

  return (
    <>
      <AdminHeader title="שדה מותאם חדש" />
      <ContactFieldForm field={null} canWrite={true} />
    </>
  );
}
