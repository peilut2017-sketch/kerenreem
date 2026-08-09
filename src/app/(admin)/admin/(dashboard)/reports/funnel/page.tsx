import { requireScreenPermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { BarList } from '@/components/admin/analytics/BarList';
import { RangePicker } from '@/components/admin/reporting/RangePicker';
import { rangeFromDays, previousPeriod, parseRangeParam, percentChange } from '@/lib/admin/reporting/date-range';
import { formatDeltaHint } from '@/lib/admin/reporting/format';

export const dynamic = 'force-dynamic';

interface FunnelCounts {
  started: number;
  contact: number;
  converted: number;
  completion: number;
}

async function getFunnel(from: Date, to: Date): Promise<FunnelCounts> {
  const supabase = await createClient();
  if (!supabase) return { started: 0, contact: 0, converted: 0, completion: 0 };
  const { data } = await supabase
    .from('checkout_sessions')
    .select('status')
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .limit(4000);
  const sessions = data ?? [];
  const started = sessions.length;
  const contact = sessions.filter((s) => s.status !== 'open').length;
  const converted = sessions.filter((s) => s.status === 'converted').length;
  return { started, contact, converted, completion: started > 0 ? Math.round((converted / started) * 100) : 0 };
}

/** [1.5] משפך רכישה — Checkout שהתחיל / הזין פרטי קשר / הושלם, עם השוואה לתקופה קודמת. */
export default async function FunnelReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireScreenPermission('reports', 'view');
  const { days: daysParam } = await searchParams;
  const days = parseRangeParam(daysParam);
  const range = rangeFromDays(days);
  const compareRange = previousPeriod(range);

  const [current, previous] = await Promise.all([
    getFunnel(range.from, range.to),
    getFunnel(compareRange.from, compareRange.to),
  ]);

  return (
    <>
      <AdminHeader
        title="משפך רכישה"
        description="התחלת Checkout ← הזנת פרטי קשר ← השלמת הזמנה. נתוני צפייה/סל מפורטים יותר יתווספו בהמשך."
        action={{ href: '/admin/reports', label: 'כל הדוחות', variant: 'quiet' }}
      />

      <RangePicker basePath="/admin/reports/funnel" days={days} />

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon="dashboard"
          label="התחילו Checkout"
          value={current.started.toLocaleString('he-IL')}
          hint={formatDeltaHint(percentChange(current.started, previous.started))}
        />
        <StatTile
          icon="orders"
          label="הזינו פרטי קשר"
          value={current.contact.toLocaleString('he-IL')}
        />
        <StatTile
          icon="store"
          label="השלימו הזמנה"
          value={current.converted.toLocaleString('he-IL')}
          hint={formatDeltaHint(percentChange(current.converted, previous.converted))}
        />
        <StatTile
          icon="analytics"
          label="שיעור השלמה"
          value={`${current.completion}%`}
          hint={
            previous.completion !== current.completion
              ? `${previous.completion}% בתקופה הקודמת`
              : undefined
          }
        />
      </div>

      <section className="admin-card px-5 py-4">
        <h2 className="mb-3 text-small font-bold text-ink">שלבי המשפך</h2>
        <BarList
          items={[
            { label: 'התחילו Checkout', value: current.started },
            { label: 'הזינו פרטי קשר', value: current.contact },
            { label: 'השלימו הזמנה', value: current.converted },
          ]}
          emptyLabel="אין נתוני Checkout בטווח."
        />
      </section>
    </>
  );
}
