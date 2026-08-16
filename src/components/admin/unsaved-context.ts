'use client';

import { createContext, useContext } from 'react';

/**
 * [1.11] דיווח "יש שינויים שלא נשמרו" ממעלה הטופס אל המעטפת שסוגרת אותו.
 *
 * EntityForm יודע מתי הטופס נערך ומתי נשמר; המעטפת (EntityFormDrawer)
 * יודעת מתי המשתמש מנסה לסגור. ההקשר מחבר ביניהם: הטופס קורא לפונקציה
 * בכל שינוי מצב, והמעטפת שומרת את הדגל ומציגה אזהרת אישור בסגירה
 * כשהוא דולק. מחוץ למעטפת (עמוד מלא) הערך null, והטופס מסתפק
 * ב-beforeunload של הדפדפן.
 */
export const UnsavedChangesContext = createContext<((dirty: boolean) => void) | null>(null);

export function useUnsavedChangesReporter(): ((dirty: boolean) => void) | null {
  return useContext(UnsavedChangesContext);
}
