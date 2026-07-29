import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getAuthor } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { AuthorForm } from '@/components/admin/AuthorForm';

export const dynamic = 'force-dynamic';

export default async function EditAuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireRole('viewer')]);
  const author = await getAuthor(id);
  if (!author) notFound();

  return (
    <>
      <AdminHeader title={author.name_he} />
      <AuthorForm author={author} canWrite={hasRole(session.profile.role, 'editor')} />
    </>
  );
}
