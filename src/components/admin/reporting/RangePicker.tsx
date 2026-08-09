import Link from 'next/link';
import { RANGE_PRESETS } from '@/lib/admin/reporting/date-range';

/** [1.5] בורר טווח אחיד לכל דוחות המכירות — אותם קישורים בכל דוח. */
export function RangePicker({ basePath, days }: { basePath: string; days: number }) {
  return (
    <div className="mb-6 flex gap-2">
      {RANGE_PRESETS.map((range) => (
        <Link
          key={range}
          href={`${basePath}?days=${range}`}
          className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-caption ${
            range === days ? 'bg-[var(--admin-accent)] text-white' : 'bg-cream-2 text-ink-soft'
          }`}
        >
          {range === 365 ? 'שנה' : `${range} ימים`}
        </Link>
      ))}
    </div>
  );
}
