import { getLocale } from 'next-intl/server';
import { formatDate, parseDateOnly, toIsoDate, type DateDisplayMode } from '@/lib/hebrew-date';

/**
 * תצוגת תאריך אחידה לכל האתר.
 *
 * הלוח העברי הוא לשון הארגון ולכן הוא מקדים בעברית; הלועזי בסוגריים
 * משלים אותו. שינוי מדיניות התצוגה נעשה כאן במקום אחד.
 */
export async function HebrewDate({
  date,
  mode = 'both',
  afterSunset = false,
  className = '',
}: {
  date: string | Date | null | undefined;
  mode?: DateDisplayMode;
  /** אירוע שמתחיל אחרי השקיעה שייך כבר לתאריך העברי של המחרת. */
  afterSunset?: boolean;
  className?: string;
}) {
  if (!date) return null;
  const parsed = parseDateOnly(date);
  if (!parsed) return null;

  const locale = await getLocale();

  return (
    <time dateTime={toIsoDate(parsed)} className={className}>
      {formatDate(parsed, locale, mode, { afterSunset })}
    </time>
  );
}
