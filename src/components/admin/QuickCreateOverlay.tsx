'use client';

import { useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Drawer } from '../Drawer';
import { ModalCloseContext } from './modal-close-context';
import { UnsavedChangesContext } from './unsaved-context';

/**
 * [1.11] כרטיס יצירה מלא שנפתח מעל כרטיס פתוח אחר — יצירת מחבר/קטגוריה/
 * סדרה עם כל השדות מתוך טופס הספר, בלי לעזוב אותו.
 *
 * מרונדר ב-Portal אל body: הטפסים המלאים (AuthorForm וכו') עטופים
 * ב-<form> משלהם, וטופס בתוך טופס הוא HTML לא חוקי — ה-Portal מוציא
 * את ה-DOM אל מחוץ לטופס הספר בעוד עץ React נשאר במקומו.
 *
 * עצירת הפצת אירועי קלט/מקלדת בשורש: אירועים סינתטיים של React מטפסים
 * בעץ הרכיבים גם דרך Portal — בלי העצירה, הקלדה בכרטיס המחבר הייתה
 * מדליקה את חיווי "שינויים שלא נשמרו" של טופס הספר שמתחתיו, ו-Ctrl+Enter
 * היה שולח את שני הטפסים.
 *
 * ModalCloseContext שמסופק כאן מקבל מ-EntityForm את מזהה הרשומה שנשמרה
 * ומעביר אותו החוצה (onCreated) יחד עם השם שהוקלד — כדי שהשדה שממנו
 * נפתח הכרטיס יבחר את הפריט החדש מיד.
 */
export function QuickCreateOverlay({
  title,
  open,
  onClose,
  onCreated,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string | null) => void;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const reportUnsaved = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const handleSavedClose = useCallback(
    (savedId?: string) => {
      if (savedId) {
        // שם הפריט שנוצר — נקרא מהשדה לפני שהכרטיס נסגר, כדי שהבחירה
        // בטופס הספר תציג תווית נכונה עוד לפני שהרענון מהשרת מגיע.
        const name =
          containerRef.current
            ?.querySelector<HTMLInputElement>('input[name="name_he"]')
            ?.value.trim() || null;
        onCreated(savedId, name);
      }
      dirtyRef.current = false;
      onClose();
    },
    [onClose, onCreated],
  );

  const guardedClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('יש שינויים שטרם נשמרו. לסגור בלי לשמור?')) {
      return;
    }
    dirtyRef.current = false;
    onClose();
  }, [onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <ModalCloseContext.Provider value={handleSavedClose}>
      <UnsavedChangesContext.Provider value={reportUnsaved}>
        <div
          ref={containerRef}
          onInput={(event) => event.stopPropagation()}
          onChange={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Drawer
            open
            onClose={guardedClose}
            titleId={titleId}
            title={title}
            widthClassName="max-w-2xl"
            variant="center"
          >
            {children}
          </Drawer>
        </div>
      </UnsavedChangesContext.Provider>
    </ModalCloseContext.Provider>,
    document.body,
  );
}
