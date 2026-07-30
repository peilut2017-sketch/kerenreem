import { notFound } from 'next/navigation';
import { requireRole, hasRole } from '@/lib/admin/auth';
import { getTag, countBooksByTag } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { TagForm } from '@/components/admin/TagForm';

export const dynamic = 'force-dynamic';

export default async function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole('viewer');
  const [tag, counts] = await Promise.all([getTag(id), countBooksByTag()]);
  if (!tag) notFound();

  return (
    <>
      <AdminHeader title={tag.name_he} />
      <TagForm
        tag={tag}
        bookCount={counts.get(tag.id) ?? 0}
        canWrite={hasRole(session.profile.role, 'editor')}
      />
    </>
  );
}
