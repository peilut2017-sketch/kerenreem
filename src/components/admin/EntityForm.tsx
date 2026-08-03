'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';
import { saveEntity, type SaveState } from '@/lib/admin/actions';
import { DeleteButton } from './DeleteButton';
import { SubmitButton } from './SubmitButton';
import { restoreFormValues } from '@/lib/restore-form';

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
  stickyActions = false,
}: {
  entity: string;
  id: string | null;
  /** מקבל את שגיאות השדות כדי להעביר אותן לשדות עצמם */
  children: (fieldErrors: Record<string, string>) => ReactNode;
  canWrite: boolean;
  backHref: string;
  /**
   * לטופס ארוך בתוך כרטיס גלול (טופס הספר עם הלשוניות): סרגל הפעולות
   * נצמד לראש אזור הגלילה במקום לשבת בתחתית כל השדות. בלי זה כפתור
   * השמירה נגיש רק אחרי גלילה לסוף לשונית ארוכה — ובכרטיס ממורכז, לא
   * בעמוד מלא, אין "סוף גלילה" נוח שרואים בלי לגלול אליו קודם.
   */
  stickyActions?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);

  const [state, action] = useActionState(async (previous: SaveState, formData: FormData) => {
    submitted.current = formData;
    return saveEntity(entity, id, previous, formData);
  }, INITIAL);

  useEffect(() => {
    if (state.status !== 'error' || !formRef.current || !submitted.current) return;
    restoreFormValues(formRef.current, submitted.current);
  }, [state]);

  const actionsBar = canWrite ? (
    <div
      className={
        stickyActions
          ? 'sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b border-rule bg-cream/95 px-6 py-4 backdrop-blur-md'
          : 'border-t border-rule pt-6'
      }
    >
      {/* ההודעה צמודה ללחצן: בסרגל צף היא כך גלויה תמיד בלי גלילה, ובסרגל
          תחתון היא לפחות נמצאת איפה שהמבט כבר נמצא אחרי הלחיצה על שמירה. */}
      {state.status === 'error' && state.message ? (
        <p role="alert" className="mb-4 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink">
          {state.message}
        </p>
      ) : null}

      {state.status === 'saved' ? (
        <p role="status" className="mb-4 border-s-2 border-gold-deep bg-cream-2 px-4 py-3 text-small text-ink">
          השינויים נשמרו.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>שמירה</SubmitButton>
        <a href={backHref} className="text-small text-muted underline underline-offset-4">
          חזרה לרשימה
        </a>
        <div className="ms-auto">{id ? <DeleteButton entity={entity} id={id} /> : null}</div>
      </div>
    </div>
  ) : (
    <p
      className={
        stickyActions
          ? 'sticky top-0 z-10 -mx-6 -mt-6 mb-6 border-b border-rule bg-cream/95 px-6 py-4 text-small text-muted backdrop-blur-md'
          : 'border-t border-rule pt-6 text-small text-muted'
      }
    >
      לתפקיד שלך יש הרשאת צפייה בלבד.
    </p>
  );

  return (
    <form ref={formRef} action={action} className="space-y-8">
      {stickyActions ? actionsBar : null}

      <fieldset disabled={!canWrite} className="space-y-8 disabled:opacity-70">
        {children(state.fieldErrors ?? {})}
      </fieldset>

      {stickyActions ? null : actionsBar}
    </form>
  );
}
