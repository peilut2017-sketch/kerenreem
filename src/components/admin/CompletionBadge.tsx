import { computeCompletion } from '@/lib/completion';
import type { Book, BookRelations } from '@/lib/supabase/types';

/**
 * תגית אחוז ההשלמה. הצבע משתנה רק ב-100% — לא מדרג בין 40 ל-70, כי
 * המשקלים שווים במכוון (ראו completion.ts) ואין לדרגות ביניים משמעות
 * שמצדיקה צבעים נוספים.
 */
export function CompletionBadge({ book, relations }: { book: Book; relations: BookRelations }) {
  const { percent, missing } = computeCompletion(book, relations);
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
