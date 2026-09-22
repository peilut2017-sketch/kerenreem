'use client';

import { saveEntity, type SaveState } from './actions';
import { beginAdminToast } from './toast-bus';
import { entityRoute } from './schema';

/**
 * [1.40] שמירה שרצה אחרי שהכרטיס כבר נסגר.
 *
 * הבעיה: שמירת ספר לוקחת זמן (הרשאה, שליפת המצב הקודם, עדכון, ארבע
 * טבלאות קישור, רענון מטמון). גם אחרי שהצד השרתי הואץ, העורך נשאר
 * תקוע מול טופס משותק וממתין. כשעורכים עשרות ספרים ברצף זה מצטבר.
 *
 * הפתרון: הלחיצה על "שמירה" (או Ctrl+Enter) סוגרת את הכרטיס מיד,
 * והשמירה עצמה ממשיכה ברקע עם חיווי — הודעת "שומר…" עם פס התקדמות
 * שמתחלפת ל"נשמר" או לשגיאה כשהיא חוזרת.
 *
 * למה מודול ברמת המודול ולא state ברכיב: הרכיב שהתחיל את השמירה כבר
 * לא קיים — הוא נסגר. state בתוכו היה נעלם עם הפירוק, והתוצאה (כולל
 * שגיאה) הייתה אובדת בשקט. הפונקציה הזו שורדת את הפירוק ואת הניווט,
 * ומדווחת דרך ערוץ ההודעות שחי ברמת הפריסה.
 *
 * מה *לא* קורה כאן: ולידציית שדה בשרת. כשהשמירה נכשלת אין כבר טופס
 * להצמיד אליו שגיאות אדומות, ולכן ההודעה נושאת את הסיבה וקישור חזרה
 * לרשומה. הקורא (EntityForm) חוסם מראש את המקרה הנפוץ בוולידציית
 * הדפדפן, כך שרוב הכשלים לא מגיעים לכאן מלכתחילה.
 */

/** שמירות שעדיין בדרך, לפי ישות+מזהה — למניעת שמירה כפולה של אותה רשומה. */
const inFlight = new Set<string>();

export function isSavingInBackground(entity: string, id: string | null): boolean {
  return inFlight.has(`${entity}:${id ?? 'new'}`);
}

/**
 * מריץ שמירה ברקע ומדווח עליה בהודעות. מחזיר את ההבטחה כדי שקורא
 * שרוצה כן להמתין (בדיקות, זרימות אחרות) יוכל.
 */
export function saveInBackground({
  entity,
  id,
  formData,
  label,
}: {
  entity: string;
  id: string | null;
  formData: FormData;
  /** שם הרשומה, להודעה — "הספר 'שערי תשובה' נשמר". */
  label: string;
}): Promise<SaveState> {
  const key = `${entity}:${id ?? 'new'}`;
  inFlight.add(key);

  const toast = beginAdminToast('שומר…', label);

  return saveEntity(entity, id, { status: 'idle' }, formData)
    .then((result) => {
      if (result.status === 'saved') {
        toast.succeed('הנתונים נשמרו', label);
        return result;
      }

      // הרשומה החדשה שנכשלה אין לה עדיין מזהה, ולכן הקישור מחזיר
      // למסך היצירה; רשומה קיימת מחזירה אל הכרטיס שלה עצמו.
      const target = id ?? result.id;
      toast.fail('השמירה נכשלה', {
        detail: result.message ?? label,
        action: {
          label: target ? 'פתיחת הכרטיס לתיקון' : 'חזרה לרשימה',
          href: target
            ? `/admin/${entityRoute(entity)}/${target}`
            : `/admin/${entityRoute(entity)}`,
        },
      });
      return result;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.fail('השמירה נכשלה', {
        detail: message,
        action: { label: 'חזרה לרשימה', href: `/admin/${entityRoute(entity)}` },
      });
      return { status: 'error', message } satisfies SaveState;
    })
    .finally(() => {
      inFlight.delete(key);
    });
}
