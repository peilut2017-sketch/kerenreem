'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * קריאה ממקורות שמחוץ ל-React — העדפת תנועה ואחסון מקומי.
 *
 * שניהם ממומשים ב-useSyncExternalStore ולא בקריאה מתוך useEffect. קריאה
 * באפקט פירושה רינדור ראשון עם ערך שגוי ואז רינדור שני מיד אחריו: הבהוב
 * גלוי, ובמקרה של אחסון מקומי גם אי-התאמה בהידרציה. ה-hook הזה נותן
 * ל-React לקרוא מהמקור החיצוני ישירות, עם תמונת מצב נפרדת לשרת.
 */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeMedia(callback: () => void) {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}

/** האם המשתמש ביקש להפחית תנועה. בשרת מניחים שלא, כמו ברירת המחדל בדפדפן. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */

/** מטמון לכל מפתח, כדי שכל הצרכנים יראו את אותו ערך ובלי לפענח JSON בכל רינדור. */
const caches = new Map<string, { raw: string; list: string[] }>();
const listeners = new Map<string, Set<() => void>>();

function parse(raw: string): string[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '[]';
  } catch {
    // גלישה פרטית או אחסון חסום — אינם סיבה להפיל עמוד
    return '[]';
  }
}

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

/**
 * רשימת מחרוזות שנשמרת מקומית ומשותפת לכל הרכיבים שקוראים אותה.
 *
 * הסנכרון בין לשוניות פתוחות נעשה דרך אירוע storage: מועדף שנוסף בלשונית
 * אחת מופיע מיד בשנייה, ולא רק אחרי רענון.
 */
export function useLocalList(key: string): {
  list: string[];
  has: (value: string) => boolean;
  toggle: (value: string) => boolean;
  push: (value: string, limit: number) => void;
} {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)!.add(callback);

      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return;
        caches.delete(key);
        notify(key);
      };

      window.addEventListener('storage', onStorage);
      return () => {
        listeners.get(key)?.delete(callback);
        window.removeEventListener('storage', onStorage);
      };
    },
    [key],
  );

  const getSnapshot = useCallback(() => {
    const raw = readRaw(key);
    const cached = caches.get(key);
    // אותה מחרוזת חייבת להחזיר אותה הפניה, אחרת React מרנדר בלולאה
    if (!cached || cached.raw !== raw) caches.set(key, { raw, list: parse(raw) });
    return caches.get(key)!.raw;
  }, [key]);

  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '[]');
  const list = raw === '[]' ? EMPTY : (caches.get(key)?.list ?? EMPTY);

  const write = useCallback(
    (next: string[]) => {
      const raw = JSON.stringify(next);
      try {
        window.localStorage.setItem(key, raw);
      } catch {
        /* אין אחסון — לפחות המצב בזיכרון יתעדכן לאורך הביקור */
      }
      caches.set(key, { raw, list: next });
      notify(key);
    },
    [key],
  );

  const toggle = useCallback(
    (value: string) => {
      const current = caches.get(key)?.list ?? [];
      const added = !current.includes(value);
      write(added ? [...current, value] : current.filter((item) => item !== value));
      return added;
    },
    [key, write],
  );

  const push = useCallback(
    (value: string, limit: number) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      const current = caches.get(key)?.list ?? [];
      write([trimmed, ...current.filter((item) => item !== trimmed)].slice(0, limit));
    },
    [key, write],
  );

  return {
    list,
    has: (value: string) => list.includes(value),
    toggle,
    push,
  };
}

/** הפניה קבועה לרשימה ריקה, כדי שרינדור בלי אחסון לא ייצור מערך חדש בכל פעם. */
const EMPTY: string[] = [];
