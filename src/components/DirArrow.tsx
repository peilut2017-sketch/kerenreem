/**
 * חץ כיווני לטקסט ("לכל הספרים ←"): forward מצביע לכיוון הקריאה (← בעברית,
 * → באנגלית), back להפך. חץ מילולי קבוע בטקסט הצביע אחורה באנגלית בכל
 * ה-CTA באתר. אין כאן hooks — עובד ברכיבי שרת ולקוח כאחד; הכיוון נקבע
 * ב-CSS לפי dir של המסמך (rtl: של Tailwind).
 */
export function DirArrow({ direction = 'forward' }: { direction?: 'forward' | 'back' }) {
  const ltr = direction === 'forward' ? '→' : '←';
  const rtl = direction === 'forward' ? '←' : '→';
  return (
    <span aria-hidden="true">
      <span className="rtl:hidden">{ltr}</span>
      <span className="hidden rtl:inline">{rtl}</span>
    </span>
  );
}
