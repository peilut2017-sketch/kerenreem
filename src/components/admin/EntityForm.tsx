'use client';

import { useActionState, type ReactNode } from 'react';
import { saveEntity, type SaveState } from '@/lib/admin/actions';
import { DeleteButton } from './DeleteButton';

const INITIAL: SaveState = { status: 'idle' };

/**
 * מעטפת הטופס לכל ישות. אחראית על השליחה ל-Server Action, על הצגת שגיאות
 * ברמת השדה, ועל סרגל הפעולות.
 *
 * השגיאות מגיעות מהשרת ולא מהדפדפן — ולידציה בצד הלקוח לבדה אפשר לעקוף.
 */
export function EntityForm({
  entity,
  id,
  children,
  canWrite,
  backHref,
}: {
  entity: string;
  id: string | null;
  /** מקבל את שגיאות השדות כדי להעביר אותן לשדות עצמם */
  children: (fieldErrors: Record<string, string>) => ReactNode;
  canWrite: boolean;
  backHref: string;
}) {
  const [state, action, pending] = useActionState(
    saveEntity.bind(null, entity, id),
    INITIAL,
  );

  return (
    <form action={action} className="space-y-8">
      <fieldset disabled={!canWrite} className="space-y-8 disabled:opacity-70">
        {children(state.fieldErrors ?? {})}
      </fieldset>

      {state.status === 'error' && state.message ? (
        <p role="alert" className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink">
          {state.message}
        </p>
      ) : null}

      {state.status === 'saved' ? (
        <p role="status" className="border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink">
          השינויים נשמרו.
        </p>
      ) : null}

      {canWrite ? (
        <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-6">
          <button type="submit" disabled={pending} className="btn btn-solid">
            {pending ? 'שומר…' : 'שמירה'}
          </button>
          <a href={backHref} className="text-small text-muted underline underline-offset-4">
            חזרה לרשימה
          </a>
          <div className="ms-auto">{id ? <DeleteButton entity={entity} id={id} /> : null}</div>
        </div>
      ) : (
        <p className="border-t border-rule pt-6 text-small text-muted">
          לתפקיד שלך יש הרשאת צפייה בלבד.
        </p>
      )}
    </form>
  );
}
