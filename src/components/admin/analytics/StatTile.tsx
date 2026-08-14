import type { AdminIconName } from '../AdminIcons';
import { AdminIcon } from '../AdminIcons';

/**
 * גוון ברירת מחדל לפי האייקון: כל עמודי הדוחות מקבלים כרטיסים צבעוניים
 * בלי לגעת בכל אתר קריאה. hue מפורש תמיד גובר.
 */
const ICON_HUE: Partial<Record<AdminIconName, string>> = {
  finance: 'admin-hue-emerald',
  store: 'admin-hue-emerald',
  orders: 'admin-hue-indigo',
  books: 'admin-hue-indigo',
  analytics: 'admin-hue-violet',
  view: 'admin-hue-sky',
  events: 'admin-hue-sky',
  pages: 'admin-hue-violet',
  inventory: 'admin-hue-amber',
  diagnostics: 'admin-hue-amber',
  coupon: 'admin-hue-rose',
  edit: 'admin-hue-amber',
  authors: 'admin-hue-violet',
  messages: 'admin-hue-rose',
};

/**
 * כרטיס סטטיסטיקה — מספר יחיד, לא גרף לערך בודד (ראו dataviz: "single
 * current value" הוא Stat tile, לא bar chart של עמודה אחת).
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  hue,
}: {
  label: string;
  value: string;
  icon: AdminIconName;
  hint?: string;
  /** גוון הכרטיס (admin-hue-*, ראו admin.css) — ברירת מחדל אינדיגו */
  hue?: string;
}) {
  return (
    <div className={`admin-stat ${hue ?? ICON_HUE[icon] ?? ''}`}>
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
