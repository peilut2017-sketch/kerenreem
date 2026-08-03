'use client';

import { useId, useState } from 'react';
import type { DailyPoint } from '@/lib/admin/analytics-queries';

/**
 * מגמת ביקורים יומית — שתי סדרות (צפיות, מבקרים ייחודיים), ולכן צבע
 * קטגוריאלי (לא sequential) עם מקרא: כחול לצפיות, כתום למבקרים ייחודיים
 * — שני הגוונים הראשונים בסדר הקטגוריאלי המאומת (ראו dataviz), שנבדקו
 * גם מול משטח הכרטיס הבהיר של הממשק (ניגודיות, הפרדת CVD, סף ראייה
 * רגילה — כולם עוברים).
 *
 * הריחוף מציג שרביט (crosshair) על ה-X הקרוב ביותר, עם tooltip יחיד
 * שמפרט את שתי הסדרות לאותו יום — לא נדרש למקד בול על הקו. לכל מי
 * שאינו יכול לרחף (מקלדת, קורא מסך) יש טבלה מלאה מתחת, תמיד קיימת
 * ב-DOM — לא רק בריחוף.
 */
const VIEWS_COLOR = '#2a78d6';
const VISITORS_COLOR = '#eb6834';

const WIDTH = 680;
const HEIGHT = 200;
const PAD_LEFT = 34;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const steps = [1, 2, 2.5, 5, 10];
  for (const step of steps) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return value;
}

export function DailyTrendChart({
  data,
  viewsLabel,
  visitorsLabel,
  tableCaption,
}: {
  data: DailyPoint[];
  viewsLabel: string;
  visitorsLabel: string;
  tableCaption: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) return null;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = niceMax(Math.max(...data.map((point) => Math.max(point.views, point.uniqueVisitors))));

  const xAt = (index: number) =>
    data.length === 1 ? PAD_LEFT : PAD_LEFT + (index / (data.length - 1)) * plotWidth;
  const yAt = (value: number) => PAD_TOP + plotHeight - (value / max) * plotHeight;

  const linePoints = (key: 'views' | 'uniqueVisitors') =>
    data.map((point, index) => `${xAt(index)},${yAt(point[key])}`).join(' ');

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * plotWidth;
    const ratio = data.length === 1 ? 0 : relativeX / plotWidth;
    const index = Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1))));
    setHoverIndex(index);
  }

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const formatDate = (iso: string) => {
    const [, month, day] = iso.split('-');
    return `${day}/${month}`;
  };
  // תווית ציר X נשמרת דלילה בכוונה — לא תאריך על כל נקודה (ראו dataviz)
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      {/* מקרא — חובה לשתי סדרות ומעלה, ולא רק תוויות ישירות */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: VIEWS_COLOR }} />
          {viewsLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: VISITORS_COLOR }} />
          {visitorsLabel}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={tableCaption}
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={gradientId}>
              <rect x={PAD_LEFT} y={PAD_TOP} width={plotWidth} height={plotHeight} />
            </clipPath>
          </defs>

          {/* קווי רשת — hairline אחידים, שקטים ביחס לנתונים */}
          {gridSteps.map((step) => {
            const y = PAD_TOP + plotHeight - step * plotHeight;
            return (
              <line
                key={step}
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--color-rule)"
                strokeWidth={1}
              />
            );
          })}
          {gridSteps.map((step) => (
            <text
              key={`label-${step}`}
              x={PAD_LEFT - 8}
              y={PAD_TOP + plotHeight - step * plotHeight}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted"
              fontSize={10}
            >
              {Math.round(max * step).toLocaleString('he-IL')}
            </text>
          ))}

          {/* תוויות ציר X — דלילות */}
          {data.map((point, index) =>
            index % xLabelEvery === 0 || index === data.length - 1 ? (
              <text
                key={point.date}
                x={xAt(index)}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted"
                fontSize={10}
              >
                {formatDate(point.date)}
              </text>
            ) : null,
          )}

          <g clipPath={`url(#${gradientId})`}>
            <polyline points={linePoints('views')} fill="none" stroke={VIEWS_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={linePoints('uniqueVisitors')} fill="none" stroke={VISITORS_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* נקודת קצה — התוויה הישירה היחידה, "עמוד/קו מוצא בקצה" */}
          <circle cx={xAt(data.length - 1)} cy={yAt(data[data.length - 1].views)} r={4} fill={VIEWS_COLOR} stroke="var(--color-cream)" strokeWidth={2} />
          <circle cx={xAt(data.length - 1)} cy={yAt(data[data.length - 1].uniqueVisitors)} r={4} fill={VISITORS_COLOR} stroke="var(--color-cream)" strokeWidth={2} />

          {/* שרביט הריחוף */}
          {hoverIndex !== null ? (
            <line
              x1={xAt(hoverIndex)}
              x2={xAt(hoverIndex)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="var(--color-muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}

          {/* משטח הריחוף — כל האזור, לא רק מעל הקו עצמו */}
          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hovered ? (
          <div
            className="pointer-events-none absolute top-2 rounded-[var(--admin-radius-btn)] border border-rule bg-cream px-3 py-2 text-caption shadow-[var(--admin-shadow-hover)]"
            style={{
              insetInlineStart: `${Math.min(78, Math.max(2, (xAt(hoverIndex!) / WIDTH) * 100))}%`,
              transform: 'translateX(-8%)',
            }}
          >
            <p className="font-semibold text-ink">{formatDate(hovered.date)}</p>
            <p style={{ color: VIEWS_COLOR }}>
              {viewsLabel}: <strong>{hovered.views.toLocaleString('he-IL')}</strong>
            </p>
            <p style={{ color: VISITORS_COLOR }}>
              {visitorsLabel}: <strong>{hovered.uniqueVisitors.toLocaleString('he-IL')}</strong>
            </p>
          </div>
        ) : null}
      </div>

      {/* טבלה מלאה — תמיד ב-DOM, לא רק בריחוף. זו הדרך הנגישה לאותו מידע
          בלי מקש עכבר: מקלדת וקורא מסך מגיעים לנתונים המלאים כאן. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-caption text-muted hover:text-ink">הצגה כטבלה</summary>
        <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--admin-radius-btn)] border border-rule">
          <table className="admin-table w-full">
            <caption className="sr-only">{tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">תאריך</th>
                <th scope="col">{viewsLabel}</th>
                <th scope="col">{visitorsLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td className="tabular-nums">{point.views.toLocaleString('he-IL')}</td>
                  <td className="tabular-nums">{point.uniqueVisitors.toLocaleString('he-IL')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
