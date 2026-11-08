import { formatAdminDate } from '@/lib/admin/reporting/format';

/**
 * ‏[1.44] מצב צפייה בהודעת דואר: "טרם נצפה" / "נצפה פעמיים · ראשונה … · אחרונה …".
 * מקבל את שדות היומן כמות שהם (email_log) ואינו תלוי בשרת — ניתן לרנדר בשני הצדדים.
 *
 * הניסוח "טרם נצפה" מכוון: המעקב מודד טעינת תמונה, לא קריאה. ההסבר המלא
 * מוצג ב-title ובמסך הדואר היוצא (lib/email/tracking.ts).
 */
export interface OpenBadgeData {
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  opens: number;
  first_opened_at: string | null;
  last_opened_at: string | null;
}

function times(count: number): string {
  if (count === 1) return 'פעם אחת';
  if (count === 2) return 'פעמיים';
  return `${count} פעמים`;
}

export function EmailOpenBadge({ data }: { data: OpenBadgeData }) {
  if (data.status === 'failed') {
    return <span className="admin-badge admin-badge-danger">השליחה נכשלה</span>;
  }
  if (data.status === 'skipped') {
    return <span className="admin-badge">לא נשלח</span>;
  }
  if (data.opens === 0) {
    return (
      <span
        className="admin-badge"
        title="לא נטענה תמונת המעקב. ייתכן שההודעה נקראה בלקוח שחוסם תמונות."
      >
        טרם נצפה
      </span>
    );
  }

  const first = formatAdminDate(data.first_opened_at, 'dateTime');
  const last = formatAdminDate(data.last_opened_at, 'dateTime');
  return (
    <span
      className="admin-badge admin-badge-success"
      title={`נצפתה לראשונה: ${first}\nנצפתה לאחרונה: ${last}\nהמספר הוא רף תחתון — חלק מלקוחות הדואר אינם טוענים את התמונה בכל פתיחה.`}
    >
      נצפה {times(data.opens)}
      <span className="font-normal tabular-nums">
        {data.opens > 1 ? ` · ראשונה ${first} · אחרונה ${last}` : ` · ${last}`}
      </span>
    </span>
  );
}
