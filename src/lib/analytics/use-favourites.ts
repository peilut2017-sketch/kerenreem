'use client';

import { useCallback } from 'react';
import { useLocalList } from '@/lib/client-hooks';
import { trackBookSaved } from './client';

/**
 * רשימת "הספרים השמורים" (kr:favourites) עם מדידה: שמירה של ספר נרשמת
 * כאירוע product_saved. ביטול שמירה אינו נרשם — המדד הוא "כמה שמרו".
 * מקור אחד לכל נקודות השמירה באתר (עמוד ספר, קטלוג, כרטיסים), כדי שאף
 * כפתור לא יישאר בלי מדידה.
 */
export function useFavourites() {
  const list = useLocalList('kr:favourites');
  const { toggle: rawToggle } = list;

  const toggle = useCallback(
    (bookId: string, title?: string): boolean => {
      const nowSaved = rawToggle(bookId);
      if (nowSaved) trackBookSaved(bookId, title);
      return nowSaved;
    },
    [rawToggle],
  );

  return { ...list, toggle };
}
