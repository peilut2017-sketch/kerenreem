'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '../Drawer';
import { ModalCloseContext } from './modal-close-context';

/**
 * מעטפת הכרטיס למסך עריכה/יצירה מיורט. הסגירה חוזרת בהיסטוריה — לא
 * מנווטת אל /admin/books במפורש — כדי שאם המשתמש הגיע דרך קישור אחר
 * (למשל מרשימת מחברים) הוא יחזור לשם ולא ל"רשימת ספרים" תמיד.
 *
 * ממורכז בעמוד (variant="center") ולא צף מהקצה: טופס ספר עם לשוניות
 * הוא תוכן גדול ומרכזי, לא פאנל סינון צדדי — ראו Drawer.tsx.
 *
 * מספק את ModalCloseContext לכל התוכן שבתוכו — EntityForm (השמור בתוך
 * BookForm) משתמש בו כדי לסגור את הכרטיס אחרי שמירה מוצלחת באותה
 * דרך בדיוק, ראו modal-close-context.ts.
 */
export function BookFormDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const titleId = useId();
  const close = () => router.back();

  return (
    <ModalCloseContext.Provider value={close}>
      <Drawer open onClose={close} titleId={titleId} title={title} widthClassName="max-w-4xl" variant="center">
        {children}
      </Drawer>
    </ModalCloseContext.Provider>
  );
}
