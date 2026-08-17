'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const IDLE_MS = 1000;
const KEYBOARD_HINT_MS = 1500;

/**
 * [1.20] "מצב קולנוע" ל-Viewer מלא-המסך: כל הבקרה (סרגל עליון, כתובית
 * משנית, הפילם-סטריפ) נעלמת יחד אחרי שנייה בלי תנועת עכבר, וחוזרת מיד
 * בכל תנועה. בוליאני יחיד + טיימר אחד — לא רינדור לכל פיקסל של תנועה.
 *
 * pause/resume קיימים בנפרד מ-wake כי מעבר עכבר שנח על הפילם-סטריפ
 * (או פוקוס מקלדת בתוכו) לא מייצר עוד eventי mousemove — בלי טיימר
 * שמושהה מפורשות, הבקרה הייתה נעלמת מתחת לעכבר שממש נמצא עליה.
 */
export function useViewerActivity() {
  const [controlsVisible, setControlsVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  const clear = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const scheduleHide = useCallback(
    (ms: number) => {
      clear();
      if (pausedRef.current) return;
      timeoutRef.current = setTimeout(() => setControlsVisible(false), ms);
    },
    [clear],
  );

  /** מעירה את הבקרה ומתזמנת הסתרה מחדש — תנועת עכבר רגילה. */
  const wake = useCallback(
    (ms: number = IDLE_MS) => {
      setControlsVisible(true);
      scheduleHide(ms);
    },
    [scheduleHide],
  );

  /** הצגה קצרה כמשוב לניווט מקלדת — לא ממתינה לתנועת עכבר. */
  const wakeBriefly = useCallback(() => wake(KEYBOARD_HINT_MS), [wake]);

  /** hover/focus על הפילם-סטריפ — עוצר את ההסתרה האוטומטית לגמרי. */
  const pause = useCallback(() => {
    pausedRef.current = true;
    clear();
    setControlsVisible(true);
  }, [clear]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    scheduleHide(IDLE_MS);
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide(IDLE_MS);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- פעם אחת בפתיחת ה-Viewer
  }, []);

  useEffect(() => {
    const onMove = () => wake(IDLE_MS);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('pointermove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('pointermove', onMove);
    };
  }, [wake]);

  return { controlsVisible, wake, wakeBriefly, pause, resume };
}
