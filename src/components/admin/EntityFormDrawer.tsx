'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '../Drawer';
import { AdminIcon } from './AdminIcons';
import { ModalCloseContext } from './modal-close-context';
import { UnsavedChangesContext } from './unsaved-context';

/**
 * מעטפת הכרטיס למסך עריכה/יצירה מיורט (ספר, מחבר, קטגוריה, סדרה, תגית).
 * הסגירה חוזרת בהיסטוריה — לא מנווטת אל הרשימה במפורש — כדי שאם המשתמש
 * הגיע דרך קישור אחר (למשל מרשימת מחברים) הוא יחזור לשם ולא לרשימה תמיד.
 *
 * ממורכז בעמוד (variant="center") ולא צף מהקצה: טופס ישות הוא תוכן גדול
 * ומרכזי, לא פאנל סינון צדדי — ראו Drawer.tsx.
 *
 * מספק את ModalCloseContext לכל התוכן שבתוכו — EntityForm משתמש בו כדי
 * לסגור את הכרטיס אחרי שמירה מוצלחת באותה דרך בדיוק, ראו
 * modal-close-context.ts.
 *
 * [1.11] מספק גם את UnsavedChangesContext: EntityForm מדווח לכאן על
 * שינויים שלא נשמרו, וסגירה ידנית (X, רקע, Escape) עם שינויים תלויים
 * מציגה אישור לפני איבודם. סגירה אחרי שמירה (דרך ModalCloseContext)
 * עוקפת את הבדיקה — EntityForm כבר איפס את הדגל.
 *
 * [1.40] אותו דיווח מדליק גם את החיווי החזותי — בשורת הכותרת של
 * הכרטיס, ליד שם הרשומה וכפתור הסגירה. שם, ולא ברצועה דביקה נפרדת
 * בגוף הטופס: זו השורה שאליה המבט חוזר כשסוגרים, והאזהרה צריכה להיות
 * בדיוק שם, על יד הכפתור שעלול לאבד את העבודה.
 */
export function EntityFormDrawer({
  title,
  children,
  widthClassName = 'max-w-4xl',
}: {
  title: string;
  children: React.ReactNode;
  widthClassName?: string;
}) {
  const router = useRouter();
  const titleId = useId();
  // ref *וגם* state. ה-ref נקרא בזמן הסגירה ותמיד עדכני גם אם הרינדור
  // טרם רץ; ה-state הוא מה שמצייר את החיווי. הדגל מתהפך פעמיים בלבד
  // בכל מחזור עריכה (נקי→מלוכלך, ובשמירה חזרה), ולכן אין כאן רינדור
  // נוסף לכל הקשה — רק לראשונה.
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const reportUnsaved = useCallback((next: boolean) => {
    dirtyRef.current = next;
    setDirty(next);
  }, []);

  const close = useCallback(() => router.back(), [router]);

  const guardedClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('יש שינויים שטרם נשמרו. לסגור בלי לשמור?')) {
      return;
    }
    close();
  }, [close]);

  return (
    <ModalCloseContext.Provider value={close}>
      <UnsavedChangesContext.Provider value={reportUnsaved}>
        <Drawer
          open
          onClose={guardedClose}
          titleId={titleId}
          title={title}
          headerExtra={
            dirty ? (
              <span
                title="יש שינויים שטרם נשמרו"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--admin-radius-btn)] bg-[var(--admin-warning-soft)] px-2 py-1 text-caption font-semibold text-[var(--admin-warning)]"
              >
                <AdminIcon name="warning" className="admin-unsaved-warning-icon h-4 w-4" />
                <span className="hidden sm:inline">שינויים שלא נשמרו</span>
                <span className="sr-only" role="status">
                  יש שינויים שטרם נשמרו
                </span>
              </span>
            ) : null
          }
          widthClassName={widthClassName}
          variant="center"
        >
          {children}
        </Drawer>
      </UnsavedChangesContext.Provider>
    </ModalCloseContext.Provider>
  );
}
