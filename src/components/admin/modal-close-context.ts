'use client';

import { createContext, useContext } from 'react';

/**
 * [1.10] מסופק ע"י מעטפת מודאל שנפתח דרך מסלול מיורט (@modal, כמו
 * BookFormDrawer) — מאפשר לרכיבים בתוכה (EntityForm, BookFormTabs)
 * לזהות שהם בתוך "כרטיס תצוגה" צף ולא עמוד רגיל.
 *
 * שימוש 1 — EntityForm: אחרי שמירה מוצלחת שאמורה "לסגור את הטופס",
 * ניווט רגיל (router.replace לכתובת הרשימה) אינו אמין תמיד מול מסלול
 * מיורט: מעבר Soft-navigation לכתובת שאינה תואמת לאף segment בתוך
 * slot מיורט לא תמיד גורם ל-Next.js להחזיר אותו לברירת המחדל
 * (default.tsx) — תקלה ידועה במסלולים מיורטים. router.back() אמין
 * יותר: הוא מסיר את רשומת ההיסטוריה של המסלול המיורט ומחזיר את
 * הדפדפן למה שהיה שם קודם — בדיוק כפי שסגירה ידנית (כפתור ה-X) כבר
 * עושה ב-BookFormDrawer.
 *
 * שימוש 2 — BookFormTabs: בתוך המגירה, סרגל הלשוניות הדביק לא צריך
 * להתחשב בגובה ה-header החיצוני (ראו שם) — תוכן המגירה גולל בפני
 * עצמו, בלי header מתחרה על אותו top:0.
 */
export const ModalCloseContext = createContext<(() => void) | null>(null);

/** null כשלא בתוך מודאל — משמש גם כדגל "האם אנחנו בתוך כרטיס תצוגה". */
export function useModalClose(): (() => void) | null {
  return useContext(ModalCloseContext);
}
