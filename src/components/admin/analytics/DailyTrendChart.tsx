'use client';

import { useId, useState } from 'react';
import { formatPrice } from '@/lib/commerce/pricing';

/**
 * מגמת ערכים יומית — סדרה אחת ומעלה (במקור: צפיות/מבקרים ייחודיים
 * באנליטיקס; משמש גם למגמת מכירות בדשבורד עם סדרה בודדת). כשיש יותר
 * מסדרה אחת — צבע קטגוריאלי (לא sequential) עם מקרא, לא תוויות ישירות.
 *
 * הריחוף מציג שרביט (crosshair) על ה-X הקרוב ביותר, עם tooltip יחיד
 * שמפרט את כל הסדרות לאותו יום — לא נדרש למקד בול על הקו. לכל מי
 * שאינו יכול לרחף (מקלדת, קורא מסך) יש טבלה מלאה מתחת, תמיד קיימת
 * ב-DOM — לא רק בריחוף.
 *
 * [1.5] שני תיקונים על הגרסה הקודמת (ביקורת ה-UI, חלק י׳):
 *  1. ה-tooltip חישב אחוז-מרחק-משמאל והחיל אותו כ-insetInlineStart —
 *     תכונה לוגית שב-RTL הופכת ל-right. הקואורדינטות של ה-SVG עצמו
 *     (xAt) הן קואורדינטות פיזיות קבועות (0=שמאל) שלא מתהפכות לפי dir,
 *     כך שאחוז שנמדד מהן חייב תכונת מיקום פיזית (left) ולא לוגית —
 *     אחרת ה-tooltip קופץ לצד הנגדי של השרביט תחת RTL.
 *  2. preserveAspectRatio="none" מותח קו ועיגולים לאליפסות בכל פעם
 *     שהקונטיינר (בפריסת Grid/Flex) גבוה או נמוך מיחס הרוחב-גובה הטבעי
 *     של ה-viewBox. הוסר לטובת ברירת המחדל (xMidYMid meet, לא מעוות),
 *     ונוסף aspect-ratio מפורש כדי שהקונטיינר לא יימתח מלכתחילה.
 */
export interface TrendSeries<T> {
  key: keyof T & string;
  label: string;
  color: string;
}

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

/**
 * [1.8] `valueFormat` ולא `formatValue`: פונקציה שמגיעה כ-prop מקומפוננטת
 * שרת (page.tsx בלי 'use client') אינה ניתנת לסריאליזציה דרך גבול
 * שרת/לקוח — Next זורק "Functions cannot be passed directly to Client
 * Components". במקום זאת מעבירים תווית פורמט (מחרוזת) והפונקציה נבחרת
 * כאן, בתוך קומפוננטת הלקוח עצמה.
 */
const VALUE_FORMATTERS: Record<'number' | 'currency', (value: number) => string> = {
  number: (value) => value.toLocaleString('he-IL'),
  currency: (value) => formatPrice(value, 'he', { alwaysAgorot: true }),
};

export function DailyTrendChart<T extends { date: string }>({
  data,
  series,
  tableCaption,
  valueFormat = 'number',
}: {
  data: T[];
  series: TrendSeries<T>[];
  tableCaption: string;
  valueFormat?: 'number' | 'currency';
}) {
  const formatValue = VALUE_FORMATTERS[valueFormat];
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (data.length === 0) return null;

  const numAt = (point: T, key: keyof T & string) => Number(point[key]) || 0;

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const max = niceMax(Math.max(...data.map((point) => Math.max(...series.map((s) => numAt(point, s.key))))));

  const xAt = (index: number) =>
    data.length === 1 ? PAD_LEFT : PAD_LEFT + (index / (data.length - 1)) * plotWidth;
  const yAt = (value: number) => PAD_TOP + plotHeight - (value / max) * plotHeight;

  const linePoints = (key: keyof T & string) =>
    data.map((point, index) => `${xAt(index)},${yAt(numAt(point, key))}`).join(' ');

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
      {series.length > 1 ? (
        <div className="mb-3 flex flex-wrap items-center gap-4 text-caption text-ink-soft">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          role="img"
          aria-label={tableCaption}
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
            {series.map((s) => (
              <polyline
                key={s.key}
                points={linePoints(s.key)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </g>

          {/* נקודת קצה — התוויה הישירה היחידה, "עמוד/קו מוצא בקצה" */}
          {series.map((s) => (
            <circle
              key={s.key}
              cx={xAt(data.length - 1)}
              cy={yAt(numAt(data[data.length - 1], s.key))}
              r={4}
              fill={s.color}
              stroke="var(--color-cream)"
              strokeWidth={2}
            />
          ))}

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
              // פיזי (left) בכוונה, לא insetInlineStart: xAt/WIDTH הוא אחוז
              // ממרחק פיזי-שמאלי קבוע בתוך ה-SVG (ראו הערת התיקון למעלה) —
              // תכונה לוגית הייתה הופכת את הצד תחת RTL.
              left: `${Math.min(78, Math.max(2, (xAt(hoverIndex!) / WIDTH) * 100))}%`,
              transform: 'translateX(-8%)',
            }}
          >
            <p className="font-semibold text-ink">{formatDate(hovered.date)}</p>
            {series.map((s) => (
              <p key={s.key} style={{ color: s.color }}>
                {s.label}: <strong>{formatValue(numAt(hovered, s.key))}</strong>
              </p>
            ))}
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
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  {series.map((s) => (
                    <td key={s.key} className="tabular-nums">
                      {formatValue(numAt(point, s.key))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
