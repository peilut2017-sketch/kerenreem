import type { AdminIconName } from '../AdminIcons';
import { AdminIcon } from '../AdminIcons';

/**
 * כרטיס סטטיסטיקה — מספר יחיד, לא גרף לערך בודד (ראו dataviz: "single
 * current value" הוא Stat tile, לא bar chart של עמודה אחת).
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: string;
  icon: AdminIconName;
  hint?: string;
}) {
  return (
    <div className="admin-stat">
      <span className="admin-icon-chip h-11 w-11">
        <AdminIcon name={icon} className="h-5 w-5" />
      </span>
      <span>
        <span className="block text-caption text-muted">{label}</span>
        <span className="mt-0.5 block font-serif text-h3 text-ink">{value}</span>
        {hint ? <span className="mt-0.5 block text-caption text-muted">{hint}</span> : null}
      </span>
    </div>
  );
}
