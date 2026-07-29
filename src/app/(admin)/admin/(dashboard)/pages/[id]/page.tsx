import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getPage } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { PageForm } from '@/components/admin/PageForm';

export const dynamic = 'force-dynamic';

export default async function EditContentPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);
  const page = await getPage(id);
  if (!page) notFound();

  return (
    <>
      <AdminHeader title={page.title_he} description={`/${page.slug}`} />
      <PageForm page={page} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
