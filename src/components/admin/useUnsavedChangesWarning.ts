'use client';

import { useEffect } from 'react';

/**
 * אזהרת דפדפן מקורית בסגירת לשונית / רענון / ניווט מלא כשיש שינויים שלא
 * נשמרו. ניווט פנימי (Link) אינו מפעיל beforeunload — שם האחריות על
 * הרכיב עצמו (ראו UnsavedChangesContext בכרטיס הצף של EntityForm).
 * הודעת הטקסט נקבעת על ידי הדפדפן; preventDefault הוא מה שמפעיל אותה.
 */
export function useUnsavedChangesWarning(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
}
