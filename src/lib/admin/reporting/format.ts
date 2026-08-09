/** [1.5] "12%▲ מהתקופה הקודמת" — עיצוב אחיד להשוואה שמופיעה כ-hint על StatTile. */
export function formatDeltaHint(percent: number | null, previousLabel = 'מהתקופה הקודמת'): string | undefined {
  if (percent === null) return `אין נתון בתקופה הקודמת להשוואה`;
  const rounded = Math.round(percent);
  if (rounded === 0) return `ללא שינוי ${previousLabel}`;
  const arrow = rounded > 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(rounded)}% ${previousLabel}`;
}
