import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listContactTopics } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable, PublishBadge } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

export default async function AdminContactTopicsPage() {
  await requireRole('viewer');
  const topics = await listContactTopics();

  return (
    <>
      <AdminHeader
        title="תחומי פנייה"
        description="הרשימה שמוצגת כבורר רשות בטופס יצירת הקשר הציבורי, למשל תמיכה, ספרים, הזמנות."
        action={{ href: '/admin/contact-topics/new', label: 'תחום חדש' }}
      />

      <AdminTable
        columns={['שם', 'סדר תצוגה', 'סטטוס', 'פעולות']}
        empty={topics.length === 0 ? 'טרם נוספו תחומי פנייה — הבורר לא יוצג בטופס עד שיתווסף תחום אחד לפחות.' : undefined}
      >
        {topics.map((topic) => (
          <AdminRow key={topic.id}>
            <AdminCell>
              <Link href={`/admin/contact-topics/${topic.id}`} className="font-semibold hover:text-burgundy">
                {topic.name_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted tabular-nums">{topic.sort_order}</AdminCell>
            <AdminCell>
              <PublishBadge published={topic.is_published} />
            </AdminCell>
            <AdminCell>
              <RowActions entity="contact_topics" id={topic.id} label={topic.name_he} published={topic.is_published} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
