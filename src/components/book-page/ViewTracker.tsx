'use client';

import { useEffect, useRef } from 'react';
import { recordBookView } from '@/lib/actions';

/**
 * מתעד צפייה בעמוד ספר, פעם אחת בטעינה.
 *
 * חייב לרוץ בלקוח ולא בתוך רינדור השרת של העמוד: העמוד עובר ISR
 * (revalidate=60), כך שקוד שרץ ברינדור עצמו נספר פעם אחת לכל בנייה
 * מחדש של המטמון ולא פעם אחת לכל ביקור — ראו incrementBookView ב-data.ts.
 */
export function ViewTracker({ slug }: { slug: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void recordBookView(slug);
  }, [slug]);

  return null;
}
