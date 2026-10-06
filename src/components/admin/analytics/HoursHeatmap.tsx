import type { HourCell } from '@/lib/admin/analytics-queries';

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

/**
 * מפת חום: יום בשבוע × שעה (זמן ישראל). גוון אחד בעוצמה משתנה (sequential)
 * — ערך מוחלט נקרא מה-title של כל תא ומהטבלה הנגישה למטה (sr-only), לא
 * מהצבע בלבד.
 */
export function HoursHeatmap({ cells }: { cells: HourCell[] }) {
  const grid = new Map(cells.map((cell) => [`${cell.dow}-${cell.hour}`, cell.views]));
  const max = Math.max(1, ...cells.map((cell) => cell.views));
  const hours = Array.from({ length: 24 }, (_, hour) => hour);

  return (
    <div className="overflow-x-auto">
      <div role="img" aria-label="מפת חום של צפיות לפי יום בשבוע ושעה" className="min-w-[34rem]">
        <div className="grid items-center gap-[3px]" style={{ gridTemplateColumns: '3.5rem repeat(24, minmax(0, 1fr))' }}>
          <span />
          {hours.map((hour) => (
            <span key={hour} className="text-center text-[10px] text-muted" dir="ltr">
              {hour % 3 === 0 ? hour : ''}
            </span>
          ))}
          {DAYS.map((day, dow) => (
            <div key={day} className="contents">
              <span className="text-caption text-ink-soft">{day}</span>
              {hours.map((hour) => {
                const views = grid.get(`${dow}-${hour}`) ?? 0;
                return (
                  <span
                    key={hour}
                    title={`${day} ${String(hour).padStart(2, '0')}:00 — ${views.toLocaleString('he-IL')} צפיות`}
                    className="h-5 rounded-[3px] bg-[#2a78d6]"
                    style={{ opacity: views === 0 ? 0.06 : 0.15 + 0.85 * (views / max) }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>צפיות לפי יום ושעה</caption>
        <tbody>
          {cells
            .filter((cell) => cell.views > 0)
            .map((cell) => (
              <tr key={`${cell.dow}-${cell.hour}`}>
                <td>{DAYS[cell.dow]}</td>
                <td>{cell.hour}:00</td>
                <td>{cell.views}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
