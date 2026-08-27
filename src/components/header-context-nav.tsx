'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * [1.30] "ניווט הקשרי" — עמוד אירוע/ספר מפרסם את שלבי/מקטעי הגלילה
 * שלו, וה-header הראשי (SiteHeaderClient) מציג אותם בתוך אותה קפסולה
 * צפה בעצמה, לא כפס נפרד שיושב מתחתיה. הקונטקסט הוא הגשר: מסופק פעם
 * אחת ברמת הפריסה הציבורית (עוטף גם את הכותרת וגם את תוכן העמוד),
 * נכתב מהעמוד ונקרא מהכותרת — בדיוק כמו PlaceholderArtProvider, רק
 * שהערך כאן דינמי (הפריט הפעיל משתנה עם הגלילה) ולא קבוע מהשרת.
 *
 * בלי זה, שני הפסים (כותרת + ניווט משני) יושבים זה מתחת לזה כשתי
 * קפסולות זכוכית נפרדות — עיצובית לא משתלב.
 */
export interface ContextNavItem {
  id: string;
  label: string;
}

/**
 * [1.32] גרסה מצומצמת של פס הכריכה/כותרת/רכישה הישן של עמוד הספר
 * (StickyNav) — לא כותרת מלאה ולא כריכה, רק מה שבאמת נחוץ כשהמשתמש כבר
 * עמוק בעמוד: מחיר וקריאה-לפעולה. מוצג ליד פעולות הכותרת (סל/מועדפים),
 * לא בתוך רצועת הניווט ההקשרי עצמה — הן שתי קבוצות שונות מבחינה תפקודית.
 */
export interface ContextNavIdentity {
  title: string;
  price?: string | null;
  onBuy?: () => void;
}

export interface ContextNavValue {
  items: ContextNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  identity?: ContextNavIdentity;
}

const HeaderContextNavContext = createContext<{
  value: ContextNavValue | null;
  setValue: (value: ContextNavValue | null) => void;
} | null>(null);

export function HeaderContextNavProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ContextNavValue | null>(null);
  return (
    <HeaderContextNavContext.Provider value={{ value, setValue }}>{children}</HeaderContextNavContext.Provider>
  );
}

/** נקרא מ-SiteHeaderClient — מה שעמוד האירוע/הספר הנוכחי פרסם, אם בכלל. */
export function useHeaderContextNav(): ContextNavValue | null {
  const ctx = useContext(HeaderContextNavContext);
  return ctx?.value ?? null;
}

/**
 * נקרא מעמוד אירוע/ספר: מפרסם את הרשימה הקבועה (items) פעם אחת, ומעדכן
 * את הפעיל (activeId) כל עוד הרכיב חי — ומנקה ביציאה מהעמוד, כדי שכותרת
 * שאר האתר לא תמשיך להציג את שלבי האירוע האחרון שביקרו בו.
 */
export function usePublishHeaderContextNav(
  items: ContextNavItem[],
  activeId: string,
  onSelect: (id: string) => void,
  identity?: ContextNavIdentity,
) {
  const ctx = useContext(HeaderContextNavContext);
  const onSelectRef = useRef(onSelect);
  const identityRef = useRef(identity);

  // עדכון ה-refs באפקט נפרד, לא בגוף הרינדור — react-hooks/refs אוסר
  // קריאה/כתיבה ל-ref.current בזמן רינדור עצמו.
  useEffect(() => {
    onSelectRef.current = onSelect;
    identityRef.current = identity;
  }, [onSelect, identity]);

  useEffect(() => {
    if (!ctx || items.length === 0) return;
    ctx.setValue({
      items,
      activeId,
      onSelect: (id) => onSelectRef.current(id),
      identity: identityRef.current
        ? {
            ...identityRef.current,
            onBuy: identityRef.current.onBuy ? () => identityRef.current?.onBuy?.() : undefined,
          }
        : undefined,
    });
    return () => ctx.setValue(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx יציב (Provider ברמת הפריסה), onSelect/identity נקראים דרך ref
  }, [items, activeId]);
}
