import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { listContactFields } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable, PublishBadge } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';

export const dynamic = 'force-dynamic';

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'טקסט קצר',
  textarea: 'טקסט ארוך',
  select: 'רשימה נפתחת',
  checkbox: 'תיבת סימון',
};

export default async function AdminContactFieldsPage() {
  await requireRole('viewer');
  const fields = await listContactFields();

  return (
    <>
      <AdminHeader
        title="שדות מותאמים"
        description="שאלות נוספות שמתווספות לטופס יצירת הקשר הציבורי, אחרי השדות הקבועים (שם, דוא״ל, טלפון, נושא, הודעה)."
        action={{ href: '/admin/contact-fields/new', label: 'שדה חדש' }}
      />

      <AdminTable
        columns={['תווית', 'סוג', 'חובה', 'סדר תצוגה', 'סטטוס', 'פעולות']}
        empty={fields.length === 0 ? 'טרם נוספו שדות מותאמים.' : undefined}
      >
        {fields.map((field) => (
          <AdminRow key={field.id}>
            <AdminCell>
              <Link href={`/admin/contact-fields/${field.id}`} className="font-semibold hover:text-burgundy">
                {field.label_he}
              </Link>
            </AdminCell>
            <AdminCell className="text-muted">{FIELD_TYPE_LABELS[field.field_type] ?? field.field_type}</AdminCell>
            <AdminCell className="text-muted">{field.is_required ? 'כן' : 'לא'}</AdminCell>
            <AdminCell className="text-muted tabular-nums">{field.sort_order}</AdminCell>
            <AdminCell>
              <PublishBadge published={field.is_published} />
            </AdminCell>
            <AdminCell>
              <RowActions entity="contact_fields" id={field.id} label={field.label_he} published={field.is_published} />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
