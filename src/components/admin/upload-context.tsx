'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * מעקב אחר העלאות קבצים שעדיין בדרך, ממעלה הטופס (ImageField/GalleryField)
 * אל כפתור השמירה.
 *
 * הבעיה: העלאת תמונה היא אסינכרונית, אבל כפתור השמירה לא ידע עליה — עורך
 * שבחר כריכה ולחץ "שמירה" לפני שההעלאה הסתיימה שמר רשומה בלי התמונה
 * וקיבל הודעת "נשמר בהצלחה". ההקשר סופר העלאות פעילות; SubmitButton
 * מושבת כל עוד הספירה חיובית. מחוץ למעטפת (ערך null) — התנהגות כמו קודם.
 */
interface UploadTracker {
  uploading: boolean;
  begin: () => void;
  end: () => void;
}

const UploadContext = createContext<UploadTracker | null>(null);

export function UploadTrackerProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const begin = useCallback(() => setCount((c) => c + 1), []);
  const end = useCallback(() => setCount((c) => Math.max(0, c - 1)), []);
  const value = useMemo<UploadTracker>(() => ({ uploading: count > 0, begin, end }), [count, begin, end]);
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

/** לרכיבי העלאה: עוטף פעולה אסינכרונית ומדווח שהיא בדרך. */
export function useUploadRegistration(): { track: <T>(op: Promise<T>) => Promise<T> } {
  const ctx = useContext(UploadContext);
  const track = useCallback(
    async <T,>(op: Promise<T>): Promise<T> => {
      if (!ctx) return op;
      ctx.begin();
      try {
        return await op;
      } finally {
        ctx.end();
      }
    },
    [ctx],
  );
  return { track };
}

/** לכפתור השמירה: האם יש העלאה פעילה שצריך להמתין לה. */
export function useIsUploading(): boolean {
  return useContext(UploadContext)?.uploading ?? false;
}
