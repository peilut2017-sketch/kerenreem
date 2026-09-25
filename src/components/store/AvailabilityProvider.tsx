'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  getLiveAvailability,
  type LiveAvailability,
} from '@/lib/books/availability-actions';
import type { BookAvailability } from '@/lib/supabase/types';

/**
 * ‏[1.42] זמינות חיה, בבקשה אחת לעמוד.
 *
 * ## מה זה פותר
 *
 * מצב המלאי היה נצרב בעמוד הסטטי, ולכן כל עמוד שמציג ספר נשא
 * ‎revalidate = 60 — נכתב מחדש בכל דקה, לנצח, רק כדי שהזמינות לא
 * תתיישן. ההסבר המלא ב-lib/books/availability-actions.ts.
 *
 * ## למה provider ולא useEffect בכל כרטיס
 *
 * עמוד קטלוג מציג 24 כרטיסים. ‏useEffect בכל אחד מהם היה 24 בקשות
 * לשרת ו-24 שאילתות — ‏N+1 קלאסי. כאן כל צרכן **נרשם**, הרישומים
 * נאספים, ואחרי השהיה קצרה יוצאת **בקשה אחת** לאיחוד המזהים.
 *
 * ## מה מונע בקשה כפולה
 *
 *  • ‏requested — כל מזהה שכבר נשלח אינו נשלח שוב. ניווט רך שמוסיף
 *    כרטיסים חדשים ישאל רק עליהם.
 *  • ‏pending — מזהים שממתינים לשליחה מצטברים לאותה בקשה.
 *  • ‏flushTimer — חלון של 60ms. הוא נועד לאפשר לכל הכרטיסים בעמוד
 *    להירשם לפני היציאה; בלעדיו הכרטיס הראשון היה יוצא לבד והשאר
 *    בבקשה שנייה.
 *
 * ## למה ref ולא state לרישום
 *
 * רישום הוא תופעת לוואי של הרכבה, לא נתון שמשפיע על הרינדור. אילו
 * היה state, כל הרכבה של כרטיס הייתה מפעילה רינדור מחדש של כל העמוד.
 * ה-state היחיד כאן הוא **התוצאות**, וזה מה שאכן צריך לצייר מחדש.
 *
 * ## מה קורה בכשל
 *
 * כלום גלוי: הצרכן נשאר עם הערך שנצרב בעמוד (ה-fallback), וכל פעולת
 * קנייה עוברת בכל מקרה דרך validateCart ו-placeOrder. זו שכבת דיוק,
 * לא שכבת אמת — האמת היא המסד, ברגע הפעולה.
 */

interface AvailabilityContextValue {
  register: (bookId: string) => void;
  results: Record<string, LiveAvailability>;
}

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null);

/** חלון האיסוף לפני היציאה. ראו ההסבר למעלה. */
const BATCH_MS = 60;

export function AvailabilityProvider({
  enabled = true,
  children,
}: {
  /** כשהחנות כבויה אין זמינות להציג, ואין טעם לשאול. */
  enabled?: boolean;
  children: ReactNode;
}) {
  const [results, setResults] = useState<Record<string, LiveAvailability>>({});

  const pending = useRef<Set<string>>(new Set());
  const requested = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flush = useCallback(() => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    if (ids.length === 0) return;
    for (const id of ids) requested.current.add(id);

    void getLiveAvailability(ids)
      .then((rows) => {
        if (!alive.current || rows.length === 0) return;
        setResults((current) => {
          const next = { ...current };
          for (const row of rows) next[row.bookId] = row;
          return next;
        });
      })
      .catch(() => {
        /*
         * כשל רשת — המזהים יוצאים מ-requested כדי שניסיון הבא (ניווט,
         * פתיחת תצוגה מהירה) ישאל עליהם שוב. בלי זה כשל חד-פעמי היה
         * משתיק את הזמינות לכל אורך הביקור.
         */
        for (const id of ids) requested.current.delete(id);
      });
  }, []);

  const register = useCallback(
    (bookId: string) => {
      if (!enabled || !bookId) return;
      if (requested.current.has(bookId) || pending.current.has(bookId)) return;
      pending.current.add(bookId);
      if (timer.current === null) timer.current = setTimeout(flush, BATCH_MS);
    },
    [enabled, flush],
  );

  return (
    <AvailabilityContext.Provider value={{ register, results }}>
      {children}
    </AvailabilityContext.Provider>
  );
}

/**
 * הזמינות החיה של ספר, עם נפילה לערך שנצרב בעמוד.
 *
 * ‏fallback הוא מה שהשרת רינדר. הוא מוצג מיד, ומוחלף בערך מהמסד ברגע
 * שהתשובה חוזרת — כך שאין הבהוב, אין קפיצת פריסה, ואין מצב שבו אין
 * כפתור בכלל עד שהבקשה חוזרת.
 *
 * ‏'catalog_only' אינו נשאל ואינו מוחלף: הוא נובע מ-is_purchasable,
 * ‏price וכיבוי החנות — שדות שמשתנים רק בשמירה בניהול, ושמירה כזו כבר
 * מרעננת את העמוד on-demand. אין סיבה לשאול עליהם את המסד בכל טעינה,
 * וגם אין סיבה שספר שאינו למכירה יהפוך לכזה בלי פריסה.
 */
export function useLiveAvailability(
  bookId: string,
  fallback: BookAvailability,
): { availability: BookAvailability; availableQuantity: number | null; live: boolean } {
  const context = useContext(AvailabilityContext);
  const volatile = fallback !== 'catalog_only';

  useEffect(() => {
    if (volatile) context?.register(bookId);
    // context.register יציב (useCallback עם תלויות קבועות); הרישום
    // תלוי רק במזהה ובשאלה אם הוא בכלל רלוונטי.
  }, [bookId, volatile, context]);

  const row = volatile ? context?.results[bookId] : undefined;
  return {
    availability: row?.availability ?? fallback,
    availableQuantity: row?.availableQuantity ?? null,
    live: row !== undefined,
  };
}
