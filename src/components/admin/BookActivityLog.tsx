'use client';

import { useEffect, useState, useTransition } from 'react';
import { getBookActivity, type BookActivityEntry } from '@/lib/admin/book-activity';
import { formatAdminDate } from '@/lib/admin/reporting/format';
import { AdminIcon, type AdminIconName } from './AdminIcons';
import { Spinner } from './SubmitButton';

/**
 * [1.40] לשונית "יומן פעולות" בכרטיס הספר — מי עשה מה, מתי, ומה בדיוק
 * השתנה.
 *
 * נטענת לפי דרישה ולא עם שאר נתוני הכרטיס: זו רשימה שגדלה עם הזמן,
 * רוב פתיחות הכרטיס אינן נוגעות בה, ואין סיבה שתאט את פתיחת הטופס.
 * הבקשה נשלחת פעם אחת בלבד לכל הרכבה — הלשוניות נשארות ב-DOM
 * (ראו BookFormTabs), ולכן הרכיב הזה אינו מתפרק במעבר בין לשוניות
 * ואין סכנה לבקשה חוזרת בכל מעבר.
 *
 * השינויים מוצגים כ"מה היה ← מה הוחלף", ולא רק כשם השדה: זו כל
 * הנקודה של יומן כזה. ערך ארוך נקטם כבר בכתיבה (compactAuditValues)
 * ולכן מה שמוצג כאן הוא מה שנשמר, בלי קיצוץ נוסף בתצוגה.
 */
export function BookActivityLog({ bookId }: { bookId: string }) {
  const [entries, setEntries] = useState<BookActivityEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getBookActivity(bookId);
      if (result.error) setError(result.error);
      setEntries(result.entries);
      setTruncated(result.truncated);
    });
  }, [bookId]);

  if (pending && entries === null) {
    return (
      <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
        <Spinner className="h-3.5 w-3.5" /> טוען את היומן…
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-small text-[var(--admin-danger)]">
        טעינת היומן נכשלה: {error}
      </p>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <p className="text-small text-muted">
        טרם נרשמו פעולות על הספר הזה. היומן מתעד מכאן ואילך כל יצירה ועריכה — כולל מה השתנה בדיוק.
      </p>
    );
  }

  return (
    <div>
      <p className="admin-field-hint mb-4">
        {entries.length.toLocaleString('he-IL')} פעולות, מהאחרונה לראשונה.
        {truncated ? ' מוצגות האחרונות בלבד; ההיסטוריה המלאה במסך יומן הביקורת.' : ''}
      </p>

      <ol className="space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="admin-card p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className={`admin-badge ${ACTION_TONE[entry.action] ?? 'admin-badge-neutral'}`}>
                <AdminIcon name={ACTION_ICON[entry.action] ?? 'edit'} className="h-3.5 w-3.5" />
                {entry.actionLabel}
              </span>
              {entry.area ? <span className="admin-badge admin-badge-neutral">{entry.area}</span> : null}
              <span className="text-small text-ink">{entry.actorName}</span>
              <time
                dateTime={entry.createdAt}
                className="ms-auto text-caption text-muted tabular-nums"
              >
                {formatAdminDate(entry.createdAt, 'dateTime')}
              </time>
            </div>

            {entry.context ? (
              <p className="mt-2 text-small text-ink-soft">{entry.context}</p>
            ) : null}

            {entry.changes.length > 0 ? (
              <ChangeList changes={entry.changes} />
            ) : (
              <p className="mt-2 text-caption text-muted">
                לא נרשם פירוט שדות לפעולה הזו.
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

const ACTION_TONE: Record<string, string> = {
  insert: 'admin-badge-success',
  update: 'admin-badge-accent',
  delete: 'admin-badge-danger',
  upload: 'admin-badge-neutral',
  reorder: 'admin-badge-neutral',
};

const ACTION_ICON: Record<string, AdminIconName> = {
  insert: 'plus',
  update: 'edit',
  delete: 'trash',
  upload: 'upload',
  reorder: 'list',
};

/** מעל כמה שדות הרשימה מקופלת מאחורי "הצגת כל השינויים". */
const COLLAPSE_AFTER = 4;

function ChangeList({ changes }: { changes: BookActivityEntry['changes'] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? changes : changes.slice(0, COLLAPSE_AFTER);
  const hidden = changes.length - shown.length;

  return (
    <div className="mt-3">
      <dl className="space-y-1.5">
        {shown.map((change) => (
          <div
            key={change.field}
            className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[10rem_1fr] sm:items-baseline"
          >
            <dt className="text-caption font-semibold text-ink-soft">{change.label}</dt>
            <dd className="min-w-0 text-small">
              {/* הכיוון auto ולא rtl: חלק מהערכים הם כתובות וקבצים
                  לטיניים, ואילוץ RTL עליהם הופך את סדר הסימנים. */}
              <span dir="auto" className="text-muted line-through decoration-1">
                {change.before ?? '(ריק)'}
              </span>
              <span aria-hidden="true" className="mx-1.5 text-muted">
                ←
              </span>
              <span dir="auto" className="break-words text-ink">
                {change.after ?? '(ריק)'}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      {hidden > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="admin-btn admin-btn-ghost mt-2"
        >
          הצגת {hidden.toLocaleString('he-IL')} שינויים נוספים
        </button>
      ) : null}
    </div>
  );
}
