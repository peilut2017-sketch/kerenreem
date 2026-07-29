import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listPagesAdmin } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable, PublishBadge } from '@/components/admin/AdminList';

export const dynamic = 'force-dynamic';

const REQUIRED_SLUGS = ['terms', 'privacy', 'accessibility'];

export default async function AdminPagesPage() {
  await requireRole('viewer');
  const pages = await listPagesAdmin();
  const missing = REQUIRED_SLUGS.filter((slug) => !pages.some((page) => page.slug === slug));

  return (
    <>
      <AdminHeader
        title="עמודי תוכן"
        description="אודות, תרומה, ועמודי החובה החוקיים."
        action={{ href: '/admin/pages/new', label: 'עמוד חדש' }}
      />

      {missing.length > 0 ? (
        <p role="alert" className="mb-6 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small">
          חסרים עמודי חובה: {missing.join(', ')}. יש להריץ את קובץ ה-seed המשפטי או ליצור אותם ידנית.
        </p>
      ) : null}

      <AdminTable
        columns={['כותרת', 'מזהה כתובת', 'עודכן', 'מצב']}
        empty={pages.length === 0 ? 'טרם נוספו עמודים.' : undefined}
      >
        {pages.map((page) => (
          <AdminRow key={page.id}>
            <AdminCell>
              <Link href={`/admin/pages/${page.id}`} className="font-semibold hover:text-burgundy">
                {page.title_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">/{page.slug}</span>
            </AdminCell>
            <AdminCell className="text-muted">
              {new Intl.DateTimeFormat('he-IL', { dateStyle: 'short' }).format(new Date(page.updated_at))}
            </AdminCell>
            <AdminCell>
              <PublishBadge published={page.is_published} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
