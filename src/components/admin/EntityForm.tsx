'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntity, type SaveState } from '@/lib/admin/actions';
import { DeleteButton } from './DeleteButton';
import { SubmitButton } from './SubmitButton';
import { restoreFormValues } from '@/lib/restore-form';

/** מזהה איזה משני כפתורי השמירה הפעיל את השליחה — ראו name="intent" למטה. */
type Intent = 'save' | 'save-new';

/**
 * SaveState עם intent מוצמד — נקבע בתוך ה-reducer של useActionState (לא
 * ברינדור, ולא ref) כדי שההחלטה על ניווט אחרי שמירה תוכל להישען עליו
 * בבטחה גם בזמן רינדור, בלי לקרוא ל-FormData.get מחוץ להקשר שמותר בו.
 */
type ClientSaveState = SaveState & { intent: Intent };

const INITIAL: ClientSaveState = { status: 'idle', intent: 'save' };

/**
 * ישויות שבהן טאבים נוספים (תמונות/תוכן עניינים לספר, בלוקי סיפור לאירוע)
 * דורשים מזהה קיים כדי להיפתח — ראו BookForm.tsx / EventBlocksEditor.tsx.
 * לכן רק בהן השמירה *הראשונה* של רשומה חדשה משאירה את הכרטיס פתוח, כדי
 * לאפשר להמשיך למלא אותם באותה ישיבה. בכל שמירה אחרת, ובכל ישות אחרת,
 * שמירה סוגרת את הכרטיס וחוזרת לרשימה.
 */
const STAYS_OPEN_ON_FIRST_SAVE = new Set(['books', 'events']);

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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  // משתנה כדי לאלץ מיחדוש (remount) מלא של הטופס אחרי "שמירה ופתיחת חדש"
  // בזמן שכבר נמצאים על מסך "חדש" — אין ניווט אמיתי (אותה כתובת בדיוק),
  // ולכן צריך דרך אחרת לאפס שדות שמנהלים state עצמאי (עורך טקסט עשיר,
  // בורר תגיות וכו') ולא רק שדות טקסט פשוטים.
  const [resetToken, setResetToken] = useState(0);
  // ה-state האחרון שכבר טופל — לזהות "שמירה חדשה" בזמן הרינדור עצמו,
  // בלי useEffect. ראו ההתאמה למטה.
  const [handledState, setHandledState] = useState<ClientSaveState>(INITIAL);

  const [state, action] = useActionState(async (previous: ClientSaveState, formData: FormData) => {
    submitted.current = formData;
    const intent: Intent = formData.get('intent') === 'save-new' ? 'save-new' : 'save';
    const result = await saveEntity(entity, id, previous, formData);
    return { ...result, intent };
  }, INITIAL);

  /*
   * "שמירה ופתיחת חדש" בזמן שכבר על מסך "חדש" (id null) מאפסת את הטופס
   * באמצעות שינוי key, ולא ב-useEffect: קריאת setState בתוך effect
   * לצורך "התאמת state כתגובה לשינוי" גורמת לרינדור נוסף מיותר. זהו
   * הדפוס הרשמי של React ל"עדכון state בזמן רינדור" (react.dev) —
   * ההשוואה מול handledState מבטיחה שהתנאי ירוץ פעם אחת בדיוק לכל
   * שמירה, לא בכל רינדור.
   */
  if (state !== handledState) {
    setHandledState(state);
    if (state.status === 'saved' && !id && state.intent === 'save-new') {
      setResetToken((count) => count + 1);
    }
  }

  useEffect(() => {
    if (state.status !== 'error' || !formRef.current || !submitted.current) return;
    restoreFormValues(formRef.current, submitted.current);
  }, [state]);

  /*
   * הכרטיס נסגר וחוזר לרשימה אחרי כל שמירה — החריג היחיד הוא שמירה
   * ראשונה של ספר/אירוע חדש (STAYS_OPEN_ON_FIRST_SAVE). "שמירה ופתיחת
   * חדש" גובר על כך תמיד: זו בחירה מפורשת לעבור לרשומה נוספת. המקרה
   * של "כבר על /new" מטופל למעלה (resetToken) ולא כאן, כי כאן אין
   * ניווט אמיתי לבצע.
   *
   * הניווט הוא client-side (router.replace) ולא redirect() בשרת, כדי
   * לא לפגוש שוב את התקלה שבגללה סגירה ידנית פתחה כרטיס ריק — ראו
   * ההערה ב-saveEntity (lib/admin/actions.ts).
   */
  useEffect(() => {
    if (state.status !== 'saved') return;

    if (state.intent === 'save-new') {
      if (id) router.replace(`/admin/${entity}/new`);
      return;
    }

    if (!id && state.id && STAYS_OPEN_ON_FIRST_SAVE.has(entity)) {
      router.replace(`/admin/${entity}/${state.id}`);
      return;
    }

    router.replace(`/admin/${entity}`);
  }, [state, entity, id, router]);

  return (
    <form ref={formRef} action={action} className="space-y-8" key={resetToken}>
      <fieldset disabled={!canWrite} className="space-y-8 disabled:opacity-70">
        {children(state.fieldErrors ?? {})}
      </fieldset>

      {canWrite ? (
        <div className="border-t border-rule pt-6">
          {/* ההודעה צמודה ללחצן ולא בראש העמוד: אחרי לחיצה על שמירה המבט
              נמצא כאן, והודעה בקצה השני של המסך פשוט אינה נראית. */}
          {state.status === 'error' && state.message ? (
            <p
              role="alert"
              className="mb-4 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small text-ink"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-4">
            <SubmitButton name="intent" value="save">
              שמירה
            </SubmitButton>
            <SubmitButton name="intent" value="save-new" className="admin-btn admin-btn-quiet">
              שמירה ופתיחת חדש
            </SubmitButton>
            <a href={backHref} className="text-small text-muted underline underline-offset-4">
              חזרה לרשימה
            </a>
            <div className="ms-auto">{id ? <DeleteButton entity={entity} id={id} /> : null}</div>
          </div>
        </div>
      ) : (
        <p className="border-t border-rule pt-6 text-small text-muted">
          לתפקיד שלך יש הרשאת צפייה בלבד.
        </p>
      )}
    </form>
  );
}
