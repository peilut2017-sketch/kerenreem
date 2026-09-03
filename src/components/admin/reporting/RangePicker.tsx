import Link from 'next/link';
import { RANGE_PRESETS } from '@/lib/admin/reporting/date-range';

/** [1.5] בורר טווח אחיד לכל דוחות המכירות — אותם קישורים בכל דוח. */
export function RangePicker({ basePath, days }: { basePath: string; days: number }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2" aria-label="טווח הדוח">
      {RANGE_PRESETS.map((range) => (
        <Link
          key={range}
          href={`${basePath}?days=${range}`}
          aria-current={range === days ? 'true' : undefined}
          className="admin-chip"
        >
          {range === 365 ? 'שנה' : `${range} ימים`}
        </Link>
      ))}
    </div>
  );
}
