'use client';

import { useCallback, useRef, useState, type DragEvent, type ReactNode } from 'react';

/**
 * [1.40] גרירת קובץ אל שדה העלאה — פרימיטיב אחד לכל מקום שמקבל קבצים
 * בממשק הניהול (כריכה, דיוקן, גלריה, עורך טקסט עשיר, ספריית מדיה,
 * גופנים, מדיית אירועים).
 *
 * שתי החלטות שמונעות את התקלות הרגילות של גרירה ב-HTML:
 *
 * 1. מונה עומק (depthRef) ולא דגל בוליאני. dragenter/dragleave נורים גם
 *    במעבר בין *ילדים* של אזור הגרירה — עם דגל פשוט, גרירה מעל התצוגה
 *    המקדימה שבתוך האזור הייתה מכבה את ההדגשה למרות שהעכבר עדיין בפנים.
 *    מונה שמצטבר ב-enter ויורד ב-leave מחזיר את המצב הנכון.
 *
 * 2. dragover חייב preventDefault, אחרת הדפדפן מסרב ל-drop ופשוט פותח
 *    את הקובץ בכרטיסייה — ההתנהגות שנראית למשתמש כ"הגרירה לא עובדת".
 *
 * סינון לפי accept נעשה כאן ולא אצל הקוראים: גרירה עוקפת את מסנן
 * הדפדפן ש-<input accept> מחיל על תיבת הבחירה, ובלעדיו אפשר להפיל PDF
 * על שדה כריכה ולקבל שגיאת אחסון סתומה במקום הודעה מובנת.
 */

/** האם הקובץ תואם למחרוזת accept בנוסח <input accept> (image/*, .pdf, …). */
export function matchesAccept(file: File, accept: string | undefined): boolean {
  if (!accept || accept.trim() === '') return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return accept.split(',').some((rawRule) => {
    const rule = rawRule.trim().toLowerCase();
    if (!rule) return false;
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

export interface FileDropZoneProps {
  /** נקרא עם הקבצים שהותרו (אחרי סינון accept). לעולם לא עם מערך ריק. */
  onFiles: (files: File[]) => void;
  /** אותה מחרוזת שנמסרת ל-<input accept>; גרירה מסוננת לפיה. */
  accept?: string;
  /** false — רק הקובץ הראשון מועבר הלאה, כמו <input> בלי multiple. */
  multiple?: boolean;
  disabled?: boolean;
  /** מחלקות על העטיפה במצב רגיל. */
  className?: string;
  /** מחלקות שמתווספות בזמן שקובץ מרחף מעל. */
  activeClassName?: string;
  /**
   * החלפת מחלקות הבסיס/הכיסוי. ברירת המחדל היא מחלקות הניהול
   * (admin.css); האתר הציבורי אינו טוען את גיליון הניהול ולכן מעביר
   * כאן מחלקות Tailwind משלו.
   */
  rootClassName?: string;
  overlayClassName?: string;
  /** כיתוב הרמז שמוצג בתוך האזור בזמן ריחוף. ברירת מחדל: "שחררו כאן". */
  hint?: string;
  children: ReactNode;
}

export function FileDropZone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  className = '',
  activeClassName = 'admin-dropzone-active',
  rootClassName = 'admin-dropzone',
  overlayClassName = 'admin-dropzone-overlay',
  hint = 'שחררו כאן להעלאה',
  children,
}: FileDropZoneProps) {
  const [over, setOver] = useState(false);
  const [rejected, setRejected] = useState(false);
  const depthRef = useRef(0);

  const reset = useCallback(() => {
    depthRef.current = 0;
    setOver(false);
    setRejected(false);
  }, []);

  /** גרירה של טקסט/קישור אינה העלאה — רק פריטים מסוג file מדליקים את האזור. */
  const carriesFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes('Files');

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (disabled || !carriesFiles(event)) return;
    event.preventDefault();
    depthRef.current += 1;
    setOver(true);
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (disabled || !carriesFiles(event)) return;
    // בלי זה הדפדפן מסרב ל-drop ופותח את הקובץ במקום להעביר אותו לדף.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function onDragLeave() {
    if (disabled) return;
    depthRef.current = Math.max(0, depthRef.current - 1);
    if (depthRef.current === 0) setOver(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    const dropped = Array.from(event.dataTransfer?.files ?? []);
    reset();
    if (dropped.length === 0) return;

    const allowed = dropped.filter((file) => matchesAccept(file, accept));
    if (allowed.length === 0) {
      setRejected(true);
      setTimeout(() => setRejected(false), 2600);
      return;
    }
    onFiles(multiple ? allowed : allowed.slice(0, 1));
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      data-dropzone
      className={`${rootClassName} ${className} ${over && !disabled ? activeClassName : ''}`}
    >
      {children}

      {over && !disabled ? (
        <span aria-hidden="true" className={overlayClassName}>
          {hint}
        </span>
      ) : null}

      {rejected ? (
        <span role="alert" className="mt-1 block text-caption text-[var(--color-burgundy)]">
          סוג הקובץ שנגרר אינו נתמך בשדה הזה.
        </span>
      ) : null}
    </div>
  );
}
