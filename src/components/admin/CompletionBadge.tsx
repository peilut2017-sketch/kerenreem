import { computeCompletion, type CompletionSignals } from '@/lib/completion';
import type { Book } from '@/lib/supabase/types';

/**
 * תגית אחוז ההשלמה. הצבע משתנה רק ב-100% — לא מדרג בין 40 ל-70: האחוז
 * כאן הוא כבר תוצאה של ניקוד משוקלל לפי ערך השדה (ראו completion.ts),
 * ואין לדרגות ביניים משמעות אחידה שמצדיקה עוד צבעים — טווח האחוזים
 * עצמו כבר משקף חשיבות, לא רק כמות.
 */
export function CompletionBadge({ book, signals }: { book: Book; signals: CompletionSignals }) {
  const { percent, missing } = computeCompletion(book, signals);
  const complete = percent === 100;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2 py-0.5 text-caption tabular-nums ${
        complete ? 'border-gold-deep text-ink-soft' : 'border-rule-strong text-muted'
      }`}
      title={complete ? 'הרשומה מלאה' : `חסר: ${missing.map((item) => item.label).join(', ')}`}
    >
      {percent}%
    </span>
  );
}
