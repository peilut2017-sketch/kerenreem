'use client';

import { useCallback, useId, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '../Drawer';
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
  // ref ולא state: הדגל נקרא רק בזמן סגירה, ורינדור מחדש של כל תוכן
  // הכרטיס על כל הקשה ראשונה בטופס הוא מחיר מיותר.
  const dirtyRef = useRef(false);
  const reportUnsaved = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
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
          widthClassName={widthClassName}
          variant="center"
        >
          {children}
        </Drawer>
      </UnsavedChangesContext.Provider>
    </ModalCloseContext.Provider>
  );
}
