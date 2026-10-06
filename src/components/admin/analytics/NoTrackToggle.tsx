'use client';

import { useLocalValue } from '@/lib/client-hooks';
import { NO_TRACK_KEY } from '@/lib/analytics/client';

/**
 * "אל תספור את המכשיר הזה" — מחריג את הצוות מהספירה (וגם מ-GA4). נשמר
 * בדפדפן הזה בלבד, ולכן יש לסמן אותו בכל מכשיר/דפדפן שבהם הצוות גולש באתר.
 */
export function NoTrackToggle() {
  const { value, set, clear } = useLocalValue(NO_TRACK_KEY);
  const excluded = value === '1';

  return (
    <label className="flex cursor-pointer items-start gap-3 text-small text-ink-soft">
      <input
        type="checkbox"
        checked={excluded}
        onChange={(event) => (event.target.checked ? set('1') : clear())}
        className="mt-1"
      />
      <span>
        <strong className="text-ink">אל תספור את הגלישה שלי מהדפדפן הזה</strong>
        <span className="block text-caption text-muted">
          מונע מצפיות הצוות (עריכה, בדיקות) להיכנס לנתונים — גם לאלה של האתר וגם ל־Google Analytics. נשמר בדפדפן
          הזה בלבד.
        </span>
      </span>
    </label>
  );
}
