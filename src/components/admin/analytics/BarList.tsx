/**
 * רשימת עמודות אופקיות — להשוואת גודל (עמודים/מפנים מובילים), לא לזיהוי
 * סדרות: גוון אחד בלבד (sequential), לא צבע שונה לכל שורה. אופקי ולא
 * אנכי כי שמות עמודים ומתחמים ארוכים (ראו dataviz: "long-named
 * categories" → horizontal bar).
 *
 * תוויות ישירות בקצה כל עמודה, לא tooltip בלבד — כך שהערך קריא גם בלי
 * מעבר עכבר ובלי JS בכלל (הרכיב הזה שרת-בלבד, לא 'use client').
 */
export function BarList({
  items,
  emptyLabel,
}: {
  items: { label: string; value: number }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-small text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-2.5">
      {items.map((item) => {
        const percent = Math.max((item.value / max) * 100, 3);
        return (
          <li key={item.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-caption text-ink-soft sm:w-44" title={item.label}>
              {item.label}
            </span>
            <span className="relative h-6 flex-1 overflow-hidden rounded-[4px] bg-cream-2">
              <span
                className="absolute inset-y-0 start-0 rounded-[4px] bg-[#2a78d6]"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-end text-caption font-semibold tabular-nums text-ink">
              {item.value.toLocaleString('he-IL')}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
