'use client';

/**
 * [1.10] ערוץ ההודעות של ממשק הניהול.
 *
 * לא Context: EntityForm קורא ל-showAdminToast() ברגע שהשמירה מצליחה,
 * ואז בדרך כלל מנווט משם מיד (סגירת כרטיס / חזרה לרשימה) — כדי
 * שההודעה תישאר גלויה גם אחרי הניווט, ToastHost מורכב פעם אחת ברמת
 * הפריסה (DashboardLayout), לא בתוך העמוד שמתחלף. Context היה עובד
 * טכנית (הפריסה אכן לא נטענת מחדש בניווט בין עמודי הניהול), אבל היה
 * מחייב לספק Provider בפריסה ולצרוך אותו בכל טופס — מנוי/פרסום גלובלי
 * פשוט יותר לאותו צורך: קורא יחיד (ToastHost) ומפרסמים רבים (כל טופס).
 *
 * [1.40] ההודעה אינה עוד "נשמר בהצלחה" חד-פעמי אלא אירוע בעל *מחזור
 * חיים*: שמירה שרצה ברקע (אחרי שהכרטיס כבר נסגר, ראו EntityForm)
 * פותחת הודעת "שומר…" עם פס התקדמות, ואותה הודעה עצמה מתעדכנת
 * ל"נשמר" או לשגיאה כשהפעולה חוזרת. לכן לכל הודעה יש מזהה יציב
 * (id) שאפשר לעדכן לפיו, ולא רק מחרוזת.
 */

export type AdminToastTone = 'success' | 'error' | 'pending';

export interface AdminToast {
  id: string;
  tone: AdminToastTone;
  message: string;
  /** פירוט משני (שם הרשומה, הסיבה לכשל) — שורה שנייה קטנה. */
  detail?: string | null;
  /**
   * כמה זמן ההודעה נשארת על המסך, במילישניות. null = עד סגירה ידנית —
   * המצב של הודעת "שומר…" (אין לה משך ידוע) ושל שגיאה (אסור שתיעלם
   * לפני שנקראה).
   */
  durationMs: number | null;
  /** פעולת תיקון/מעבר, למשל "פתיחת הכרטיס" אחרי שמירה שנכשלה. */
  action?: { label: string; href: string } | null;
}

type Listener = (toast: AdminToast) => void;
type DismissListener = (id: string) => void;

const listeners = new Set<Listener>();
const dismissListeners = new Set<DismissListener>();

/** משך ברירת המחדל להודעת הצלחה — גם אורך פס הטיימר בהודעה. */
export const ADMIN_TOAST_DEFAULT_MS = 4500;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `t${counter}-${Date.now().toString(36)}`;
}

function publish(toast: AdminToast): string {
  listeners.forEach((listener) => listener(toast));
  return toast.id;
}

/**
 * הודעה פשוטה. נשארת תואמת לקריאות הישנות — showAdminToast('נשמר')
 * עדיין עובד ומתנהג כהודעת הצלחה רגילה.
 */
export function showAdminToast(
  message: string,
  options: {
    tone?: AdminToastTone;
    detail?: string | null;
    durationMs?: number | null;
    action?: AdminToast['action'];
    /** עדכון הודעה קיימת במקום פתיחת חדשה (ראו beginAdminToast). */
    id?: string;
  } = {},
): string {
  const tone = options.tone ?? 'success';
  return publish({
    id: options.id ?? nextId(),
    tone,
    message,
    detail: options.detail ?? null,
    durationMs:
      options.durationMs !== undefined
        ? options.durationMs
        : tone === 'error'
          ? null
          : ADMIN_TOAST_DEFAULT_MS,
    action: options.action ?? null,
  });
}

/**
 * הודעת "בתהליך" שמתעדכנת בסיום. מחזירה ידית — הקורא מדווח בה הצלחה
 * או כשל, ואותה הודעה על המסך מתחלפת במקום להצטבר לשתיים.
 */
export function beginAdminToast(message: string, detail?: string | null): {
  id: string;
  succeed: (message: string, detail?: string | null) => void;
  fail: (message: string, options?: { detail?: string | null; action?: AdminToast['action'] }) => void;
} {
  const id = showAdminToast(message, { tone: 'pending', detail, durationMs: null, id: nextId() });
  return {
    id,
    succeed: (doneMessage, doneDetail) =>
      void showAdminToast(doneMessage, { id, tone: 'success', detail: doneDetail ?? null }),
    fail: (failMessage, options) =>
      void showAdminToast(failMessage, {
        id,
        tone: 'error',
        detail: options?.detail ?? null,
        action: options?.action ?? null,
        durationMs: null,
      }),
  };
}

export function dismissAdminToast(id: string): void {
  dismissListeners.forEach((listener) => listener(id));
}

export function subscribeAdminToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeAdminToastDismiss(listener: DismissListener): () => void {
  dismissListeners.add(listener);
  return () => dismissListeners.delete(listener);
}
