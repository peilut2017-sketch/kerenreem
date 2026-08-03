'use client';

import { useState, useTransition } from 'react';
import { purgeOldPageViews } from '@/lib/analytics/actions';
import { AdminIcon } from '../AdminIcons';
import { Spinner } from '../SubmitButton';

/**
 * מחיקת נתוני מדידת שימוש ישנים, מעבר לתקופת השמירה שהוצהרה במדיניות
 * הפרטיות (ראו ANALYTICS_RETENTION_MONTHS). אישור בתוך הדף, לא חלון
 * confirm של הדפדפן — כמו DeleteButton.tsx, מאותה סיבה בדיוק.
 */
export function PurgeAnalyticsButton({ retentionMonths }: { retentionMonths: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!confirming) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={() => setConfirming(true)} className="admin-btn admin-btn-quiet">
          <AdminIcon name="trash" className="h-4 w-4" />
          מחיקת נתונים ישנים מ-{retentionMonths} חודשים
        </button>
        {result ? (
          <p role="status" className={`text-caption ${result.ok ? 'text-muted' : 'text-[var(--admin-danger)]'}`}>
            {result.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-small">
      <span role="alert" className="font-semibold text-[var(--admin-danger)]">
        למחוק לצמיתות כל רשומת ביקור מלפני {retentionMonths} חודשים?
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const outcome = await purgeOldPageViews();
            setResult({ ok: outcome.status === 'done', message: outcome.message ?? '' });
            setConfirming(false);
          })
        }
        className="admin-btn admin-btn-danger"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
        {pending ? 'מוחק…' : 'כן, למחוק'}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="admin-btn admin-btn-ghost">
        <AdminIcon name="x" className="h-4 w-4" />
        ביטול
      </button>
    </span>
  );
}
