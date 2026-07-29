/**
 * ערכת אייקונים — קווית, במשקל אחיד, בהשראת חיתוכי עץ של שערי ספרים.
 *
 * אייקון מופיע רק כשהוא נושא מידע: הוא מבדיל בין ארבעת צירי הפעילות
 * במבט אחד, ובין טלפון לדואר לכתובת. אין אייקון "לקישוט" ליד כותרת —
 * שם הטיפוגרפיה עושה את העבודה טוב יותר.
 *
 * השמות תואמים לשדה `icon` בטבלת activities, שכבר קיים בסכימה.
 */

export type IconName =
  | 'book-open'
  | 'academic-cap'
  | 'heart'
  | 'scroll'
  | 'quill'
  | 'candle'
  | 'building';

const PATHS: Record<IconName, React.ReactNode> = {
  // ספר פתוח — הוצאה לאור
  'book-open': (
    <>
      <path d="M24 15c-4.4-3.2-10.2-4.6-16-4v22c5.8-.6 11.6.8 16 4 4.4-3.2 10.2-4.6 16-4V11c-5.8-.6-11.6.8-16 4Z" />
      <path d="M24 15v22" />
    </>
  ),
  // שערי בית מדרש — אחזקת תורה
  'academic-cap': (
    <>
      <path d="M8 42V20c0-8.8 7.2-16 16-16s16 7.2 16 16v22" />
      <path d="M24 42V22M16 42V26M32 42V26" />
      <path d="M4 42h40" />
    </>
  ),
  // לב — צדקה וחסד
  heart: (
    <path d="M24 40S8 30 8 19.5C8 14 12.3 10 17.4 10c3 0 5.6 1.4 7.3 3.6C26.4 11.4 29 10 32 10c5.1 0 9.4 4 9.4 9.5C41.4 30 24 40 24 40Z" />
  ),
  // מגילה — ספר תורה ומורשת
  scroll: (
    <>
      <path d="M14 8h20a4 4 0 0 1 4 4v24a4 4 0 0 0 4 4H14a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4Z" />
      <path d="M18 17h12M18 24h12M18 31h8" />
    </>
  ),
  // קולמוס — ההדרה ועריכה
  quill: (
    <>
      <path d="M10 40c0-14 10-26 28-30-2 16-10 26-22 28l-6 2Z" />
      <path d="M10 40 22 28" />
    </>
  ),
  // נר — הנצחה
  candle: (
    <>
      <path d="M24 14c0-4-4-5-4-8 3 1 8 3 8 8a4 4 0 0 1-8 0" />
      <path d="M17 22h14v20H17z" />
      <path d="M13 42h22" />
    </>
  ),
  // מבנה — המכון
  building: (
    <>
      <path d="M6 42h36M10 42V16l14-8 14 8v26" />
      <path d="M19 42V29h10v13" />
    </>
  ),
};

export function Icon({
  name,
  className = '',
  title,
}: {
  name: IconName | string | null | undefined;
  className?: string;
  /** כשמסופק, האייקון מקבל שם נגיש. אחרת הוא דקורטיבי ומוסתר. */
  title?: string;
}) {
  const path = name && name in PATHS ? PATHS[name as IconName] : null;
  if (!path) return null;

  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {path}
    </svg>
  );
}

/** האם קיים אייקון בשם הזה — לבחירה בין פריסה עם אייקון לפריסה בלעדיו. */
export function hasIcon(name: string | null | undefined): boolean {
  return Boolean(name && name in PATHS);
}
