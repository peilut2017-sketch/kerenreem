/**
 * [1.40] "מהדורה בת N כרכים" — חיווי שמספר הכרכים נקרא מיד באזור
 * הכותרת, ולא רק אחרי גלילה אל טבלת המפרט.
 *
 * למה דווקא כך, מבין האפשרויות ששקלנו:
 *
 *  • *לא* כחלק משם הספר ("שם הספר (ד׳ כרכים)"). השם הוא נתון קטלוגי;
 *    הדבקת מידע אליו שוברת חיפוש, ציטוט, מטא-דאטה ותוצאות גוגל.
 *  • *לא* כתג נוסף בשורת התגים שמעל הכותרת. שם יושבים תגי *סטטוס*
 *    ("בקרוב", "בחירת המכון") — טענות שיווקיות. מספר כרכים הוא עובדה
 *    פיזית על העותק, ולערבב ביניהם מטשטש את שניהם. חוץ מזה, אותה שורה
 *    כבר מוגבלת לשני תגים בכוונה (ראו BookHero).
 *  • כן: שבב נפרד ומובחן צמוד לכותרת, עם סימן של שדרות עומדות. הוא
 *    אומר "זה אובייקט מרובה כרכים" במבט, ולא מתחרה על מקום עם התגים.
 *
 * הסימן נבנה כ-SVG מוטבע ולא כאייקון חיצוני: הוא כמה מלבנים, ויורש את
 * הצבע מהשבב — כך הוא נכון גם על נייר וגם על רקע כהה.
 */
export function VolumesBadge({
  count,
  label,
  title,
  className = '',
}: {
  count: number;
  /** "4 כרכים" — כבר מתורגם ומנוסח. */
  label: string;
  /** תיאור מלא ל-title/aria — "מהדורה בת 4 כרכים". */
  title: string;
  className?: string;
}) {
  // כרך יחיד אינו "מהדורה רב-כרכית" — אין מה לציין.
  if (!count || count < 2) return null;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-navy/25 bg-navy/[0.06] px-3 py-1 text-caption font-semibold text-navy ${className}`}
    >
      <VolumesMark />
      <span>{label}</span>
      {/* השם הנגיש הוא המשפט המלא; הכיתוב הקצר שלצדו הוא כבר חלק ממנו,
          ולכן הוא מוסתר מקורא מסך כדי לא להיקרא פעמיים. */}
      <span className="sr-only">{title}</span>
    </span>
  );
}

function VolumesMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none">
      {/* שלוש שדרות עומדות, האמצעית גבוהה — צללית של סדרה על מדף */}
      <rect x="1.5" y="4.5" width="3" height="9.5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="6.5" y="2" width="3" height="12" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
      <rect x="11.5" y="5.5" width="3" height="8.5" rx="0.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
