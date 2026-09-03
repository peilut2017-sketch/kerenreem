'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteEntity, togglePublished } from '@/lib/admin/actions';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';
import { entityRoute } from '@/lib/admin/schema';

/**
 * מתג פרסום מתוך שורת הרשימה.
 *
 * aria-pressed מוסר את המצב לקורא מסך, ו-disabled מונע לחיצה כפולה בזמן
 * ההמתנה. כשל מוצג ליד המתג: קודם לכן הפעולה נכשלה בשקט, והמתג פשוט לא זז
 * בלי שום הסבר.
 */
export function PublishToggle({
  entity,
  id,
  published,
  label,
}: {
  entity: string;
  id: string;
  published: boolean;
  label: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        aria-pressed={published}
        aria-label={`${published ? 'הסתרת' : 'פרסום'} ${label}`}
        title={published ? 'מפורסם — לחיצה תסיר מהאתר' : 'טיוטה — לחיצה תפרסם'}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await togglePublished(entity, id, !published);
            if (result?.error) setError(result.error);
          })
        }
        className={`admin-badge admin-badge-button ${published ? 'admin-badge-success' : 'admin-badge-warning'}`}
      >
        {pending ? <Spinner className="h-3 w-3" /> : <span className="admin-badge-dot" aria-hidden="true" />}
        {published ? 'מפורסם' : 'טיוטה'}
      </button>
      {error ? (
        <span role="alert" className="text-caption text-[var(--admin-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * מחיקה מתוך שורת הרשימה, בשני שלבים.
 *
 * אין חלון confirm של הדפדפן — הוא אינו נגיש לקורא מסך ואינו ניתן לעיצוב.
 */
export function RowDelete({
  entity,
  id,
  label,
}: {
  entity: string;
  id: string;
  label: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`מחיקת ${label}`}
        title="מחיקה"
        className="admin-btn admin-btn-icon admin-btn-ghost"
      >
        <AdminIcon name="trash" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-caption">
      <span role="alert" className="font-semibold text-[var(--admin-danger)]">
        למחוק?
      </span>
      <button
        type="button"
        disabled={pending}
        aria-label={`אישור מחיקת ${label}`}
        title="כן, למחוק"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await deleteEntity(entity, id);
            if (result?.error) {
              setError(result.error);
              setConfirming(false);
            }
          })
        }
        className="admin-btn admin-btn-danger admin-btn-icon"
      >
        {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        aria-label="ביטול מחיקה"
        title="ביטול"
        className="admin-btn admin-btn-ghost admin-btn-icon"
      >
        <AdminIcon name="x" className="h-4 w-4" />
      </button>
      {error ? (
        <span role="alert" className="w-full text-[var(--admin-danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * עמודת הפעולות של שורה: מעבר לעמוד הציבורי (כשיש), עריכה, מצב פרסום
 * ומחיקה — כפתורי אייקון עם tooltip, לא קישורי טקסט מקווקוים.
 */
export function RowActions({
  entity,
  id,
  label,
  published,
  viewHref,
}: {
  entity: string;
  id: string;
  label: string;
  /** undefined לישות שאין לה מצב פרסום, כמו קטגוריה */
  published?: boolean;
  /** קישור לתצוגה החיה באתר הציבורי, כשקיימת (ראו BooksDataGrid) */
  viewHref?: string;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {viewHref ? (
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`צפייה ב-${label} באתר`}
          title="צפייה באתר"
          className="admin-btn admin-btn-icon admin-btn-ghost"
        >
          <AdminIcon name="external" className="h-4 w-4" />
        </a>
      ) : null}

      <Link
        href={`/admin/${entityRoute(entity)}/${id}`}
        aria-label={`עריכת ${label}`}
        title="עריכה"
        className="admin-btn admin-btn-icon admin-btn-ghost"
      >
        <AdminIcon name="edit" className="h-4 w-4" />
      </Link>

      {published === undefined ? null : (
        <PublishToggle entity={entity} id={id} published={published} label={label} />
      )}

      <RowDelete entity={entity} id={id} label={label} />
    </span>
  );
}
