'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { saveEntity, type SaveState } from '@/lib/admin/actions';
import { saveInBackground } from '@/lib/admin/background-save';
import { DeleteButton } from './DeleteButton';
import { useUnsavedChangesWarning } from './useUnsavedChangesWarning';
import { SubmitButton } from './SubmitButton';
import { restoreFormValues } from '@/lib/restore-form';
import { showAdminToast } from '@/lib/admin/toast-bus';
import { useModalClose } from './modal-close-context';
import { useUnsavedChangesReporter } from './unsaved-context';
import { UploadTrackerProvider, useIsUploading } from './upload-context';
import { entityRoute } from '@/lib/admin/schema';

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
 *
 * [1.40] המעטפת החיצונית היא מעקב ההעלאות בלבד, והוא חייב לעטוף את
 * הטופס *מבחוץ* כדי
 * שגוף הטופס עצמו יוכל לקרוא אותו (useIsUploading) ולא רק שדות שבתוכו.
 * שמירה אופטימית (סגירת הכרטיס מיד) חייבת לדעת אם יש העלאה בדרך —
 * אחרת שמירה שנסגרה מוקדם הייתה מפספסת את הכריכה שהרגע נבחרה.
 */
export function EntityForm(props: EntityFormProps) {
  return (
    <UploadTrackerProvider>
      <EntityFormBody {...props} />
    </UploadTrackerProvider>
  );
}

interface EntityFormProps {
  entity: string;
  id: string | null;
  /**
   * מקבל את שגיאות השדות (לשדות עצמם) וגם dirty — [1.27] לטפסים שרוצים
   * להציג את חיווי "שינויים שלא נשמרו" (ואולי כפתור שמירה מהירה משלהם,
   * button type="submit" רגיל — הוא כבר בתוך ה-form הזה דרך children)
   * במיקום משלהם, למשל בכותרת הכרטיס, במקום/בנוסף לסרגל התחתון.
   */
  children: (fieldErrors: Record<string, string>, state: { dirty: boolean }) => ReactNode;
  canWrite: boolean;
  backHref: string;
}

function EntityFormBody({ entity, id, children, canWrite, backHref }: EntityFormProps) {
  const router = useRouter();
  const uploading = useIsUploading();
  const closeModal = useModalClose();
  const reportUnsaved = useUnsavedChangesReporter();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  // [1.11] חיווי "שינויים שלא נשמרו": נדלק בכל קלט, נכבה בשמירה מוצלחת.
  const [dirty, setDirty] = useState(false);
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
    if (state.status === 'saved') {
      // הטופס חזר למצב שמור — כיבוי חיווי "שינויים שלא נשמרו" באותו
      // דפוס רינדור בדיוק (לא באפקט); הדיווח למעטפת כותב ל-ref בלבד.
      setDirty(false);
      reportUnsaved?.(false);
    }
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
   * ההערה ב-saveEntity (lib/admin/actions.ts). router.refresh() אחרי
   * כל ניווט הוא רשת ביטחון נוספת: מכריח את Next.js להעריך מחדש את כל
   * המשבצות המקבילות (כולל @modal) לפי הכתובת החדשה, ולא לסמוך רק על
   * כך שהניווט הרך יעדכן אותן מעצמו.
   *
   * [1.10] הודעת "נשמר בהצלחה" מוצגת בכל שמירה מוצלחת, בלי קשר למה
   * שקורה אחריה (סגירה, המשך פתוח, או "שמירה ופתיחת חדש") — ToastHost
   * ברמת הפריסה שורד את הניווט שקורה מיד אחרי, ראו toast-bus.ts.
   *
   * [1.10] "סגירת כרטיס" בתוך מסלול מיורט (@modal, ראו BookFormDrawer)
   * לא סוגרת אמינה דרך router.replace לכתובת שאינה תואמת אף segment
   * ב-slot המיורט — תקלה ידועה של מסלולים מיורטים. closeModal (מ-
   * ModalCloseContext, קיים רק כשבאמת בתוך מודאל) עושה בדיוק מה
   * שהסגירה הידנית כבר עושה: router.back(). מחוץ למודאל closeModal הוא
   * null, וההתנהגות הרגילה (replace לרשימה) נשארת כפי שהייתה.
   */
  useEffect(() => {
    if (state.status !== 'saved') return;
    showAdminToast('הנתונים נשמרו בהצלחה');

    if (state.intent === 'save-new') {
      if (id) {
        router.replace(`/admin/${entityRoute(entity)}/new`);
        router.refresh();
      }
      return;
    }

    if (!id && state.id && STAYS_OPEN_ON_FIRST_SAVE.has(entity)) {
      router.replace(`/admin/${entity}/${state.id}`);
      router.refresh();
      return;
    }

    if (closeModal) {
      closeModal(state.id ?? undefined);
      router.refresh();
      return;
    }

    router.replace(`/admin/${entityRoute(entity)}`);
    router.refresh();
  }, [state, entity, id, router, closeModal, reportUnsaved]);

  /*
   * [1.11] סגירת לשונית/רענון עם שינויים שלא נשמרו — אזהרת דפדפן מקורית.
   * סגירת *הכרטיס הצף* (X, רקע, Escape) מטופלת במעטפת (EntityFormDrawer)
   * דרך UnsavedChangesContext — לדפדפן אין אירוע עבורה.
   */
  useUnsavedChangesWarning(dirty);

  /**
   * כל קלט בטופס מדליק את הדגל — פעם אחת, לא בכל הקשה. שדה autoSave
   * (ToggleField עם entityKey+id, למשל "מלאי מנוהל" בטופס הספר) כבר
   * נשמר לבדו ברגע הלחיצה — הוא אינו חלק מ"שמירה" הממתינה לכפתור,
   * ואין להזהיר על אובדנו ביציאה.
   */
  function markDirty(event?: React.SyntheticEvent) {
    if (dirty) return;
    const target = event?.target as HTMLElement | undefined;
    if (target?.closest?.('[data-autosave]')) return;
    setDirty(true);
    reportUnsaved?.(true);
  }

  /**
   * [1.10] Ctrl/Cmd+Enter שולח את הטופס כאילו נלחץ "שמירה" — בכל מקום
   * בתוכו, כולל שדה טקסט או עורך טקסט עשיר, לא רק כשהפוקוס על כפתור.
   * requestSubmit() בלי submitter מדמה בדיוק את כפתור ה"שמירה" הראשי:
   * formData.get('intent') חוזר null, וה-reducer שלמעלה מברירת מחדל
   * ל-'save' (לא 'save-new') בדיוק כמו שהיה קורה בלי שדה intent כלל.
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  /**
   * [1.40] שמירה של רשומה *קיימת* סוגרת את הכרטיס מיד ונשמרת ברקע.
   *
   * זה מה שהתבקש, וזה גם מה שנכון: העורך כבר סיים עם הרשומה הזו ברגע
   * שלחץ שמירה, ואין סיבה שימתין מול טופס משותק עד שהמסד יסיים. חיווי
   * ההתקדמות וההודעה בסיום עוברים לערוץ ההודעות, ששורד את הסגירה
   * (ראו background-save.ts).
   *
   * שלושה מקרים ממשיכים דרך הזרימה המסונכרנת הישנה, ולכל אחד סיבה:
   *  • רשומה חדשה — המזהה שנוצר הוא שקובע לאן ממשיכים (כרטיס הספר
   *    נשאר פתוח כדי למלא תמונות/תוכן עניינים), ואי אפשר לנחש אותו.
   *  • "שמירה ופתיחת חדש" — אין כאן סגירה, הטופס נשאר על המסך.
   *  • העלאת קובץ שעדיין בדרך — סגירה עכשיו הייתה שומרת רשומה בלי
   *    התמונה שנבחרה.
   *
   * ולידציית הדפדפן נבדקת לפני הסגירה (reportValidity): ברגע שהכרטיס
   * נסגר אין עוד שדות להאיר באדום, ולכן עדיף שהמקרה הנפוץ של "שדה
   * חובה ריק" ייעצר כאן ולא יגיע להודעת שגיאה מנותקת.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!id || uploading) return;

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'save-new') return;

    if (!form.reportValidity()) {
      event.preventDefault();
      return;
    }

    event.preventDefault();

    const formData = new FormData(form);
    // כפתור השליחה עצמו אינו נכלל ב-FormData שנבנה ידנית; ה-intent
    // כאן הוא תמיד 'save' (המקרה של 'save-new' יצא למעלה).
    formData.set('intent', 'save');

    setDirty(false);
    reportUnsaved?.(false);

    const label =
      ['title_he', 'name_he', 'label_he', 'subject', 'full_name']
        .map((field) => formData.get(field))
        .find((value): value is string => typeof value === 'string' && value.trim() !== '') ?? '';

    void saveInBackground({ entity, id, formData, label }).then(() => {
      // רענון אחרי שהשמירה חזרה, לא לפניה: רשימה שמתרעננת בזמן
      // שהשמירה עוד רצה מציגה את הערכים הישנים ונראית כאילו לא נשמר.
      router.refresh();
    });

    if (closeModal) closeModal(id);
    else router.replace(`/admin/${entityRoute(entity)}`);
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      onInput={markDirty}
      onChange={markDirty}
      className="space-y-8"
      key={resetToken}
    >
      <fieldset disabled={!canWrite} className="space-y-8 disabled:opacity-70">
        {children(state.fieldErrors ?? {}, { dirty })}
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
