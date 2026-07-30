'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { deleteEntity, togglePublished } from '@/lib/admin/actions';
import { Spinner } from './SubmitButton';

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
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await togglePublished(entity, id, !published);
            if (result?.error) setError(result.error);
          })
        }
        className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-1 text-caption transition-colors disabled:opacity-60 ${
          published
            ? 'border-rule-strong text-muted hover:border-burgundy hover:text-burgundy'
            : 'border-burgundy text-burgundy hover:bg-burgundy/5'
        }`}
      >
        {pending ? <Spinner className="h-3 w-3" /> : null}
        {published ? 'מפורסם' : 'טיוטה'}
      </button>
      {error ? (
        <span role="alert" className="text-caption text-burgundy">
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
        className="text-caption text-burgundy underline underline-offset-4"
      >
        מחיקה
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1 text-caption">
      <span className="flex items-center gap-2">
        <span role="alert">למחוק?</span>
        <button
          type="button"
          disabled={pending}
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
          className="inline-flex items-center gap-1.5 font-semibold text-burgundy underline underline-offset-4"
        >
          {pending ? <Spinner className="h-3 w-3" /> : null}
          {pending ? 'מוחק…' : 'כן'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-muted underline underline-offset-4"
        >
          ביטול
        </button>
      </span>
      {error ? (
        <span role="alert" className="text-burgundy">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * עמודת הפעולות של שורה: עריכה, מצב פרסום ומחיקה.
 *
 * קודם לכן השורה הייתה קישור אחד על הכותרת בלבד — לא היה שום רמז שאפשר
 * למחוק או לשנות מצב פרסום בלי להיכנס לרשומה.
 */
export function RowActions({
  entity,
  id,
  label,
  published,
}: {
  entity: string;
  id: string;
  label: string;
  /** undefined לישות שאין לה מצב פרסום, כמו קטגוריה */
  published?: boolean;
}) {
  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link
        href={`/admin/${entity}/${id}`}
        aria-label={`עריכת ${label}`}
        className="text-caption text-ink underline underline-offset-4 hover:text-burgundy"
      >
        עריכה
      </Link>
      {published === undefined ? null : (
        <PublishToggle entity={entity} id={id} published={published} label={label} />
      )}
      <RowDelete entity={entity} id={id} label={label} />
    </span>
  );
}
