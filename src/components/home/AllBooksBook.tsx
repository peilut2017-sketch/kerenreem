'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * [1.31] לחצן "לכל הספרים" — אייקון ספר שוכב, במבט צד ממש.
 *
 * הספר שוכב סגור: שתי כריכות (למעלה ולמטה), גוש הדפים ביניהן, והשדרה
 * בקצה הימני. לחיצה מדמה את פתיחת הדפים לימין — הכריכה העליונה וכמה
 * דפים בודדים מסתובבים בזה אחר זה סביב השדרה, נפרשים כמניפה על הצד
 * הימני — ורק אז מתבצע המעבר לעמוד כל הספרים.
 *
 * המיקומים והסיבובים כאן פיזיים (left/right, זווית חיובית = עם כיוון
 * השעון) ולא לוגיים (start/end) בכוונה: "הדפים נפתחים לימין" הוא כיוון
 * ויזואלי מוחלט, שלא אמור להתהפך עם כיוון המסמך.
 *
 * נגישות: זהו <Link> אמיתי אל /books — קליק עם מקש עזר (פתיחה
 * בכרטיסייה חדשה), קורא מסך או כשל JS מנווטים כרגיל; מי שביקש
 * reduced-motion מנווט מיד, בלי ההשהיה של האנימציה.
 */

/** הדפים המתעופפים: זווית סופית וזמן ההשהיה שלהם — מהכריכה פנימה. */
const FLIP_LEAVES = [
  { bottom: 40, height: 6, isCover: true, openAngle: 178, delay: 0, hoverAngle: 14 },
  { bottom: 37, height: 3, isCover: false, openAngle: 160, delay: 70, hoverAngle: 7 },
  { bottom: 33, height: 3, isCover: false, openAngle: 135, delay: 140, hoverAngle: 3 },
  { bottom: 29, height: 3, isCover: false, openAngle: 108, delay: 210, hoverAngle: 0 },
] as const;

export function AllBooksBook({ label }: { label: string }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [hovering, setHovering] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function onClick(event: React.MouseEvent<HTMLAnchorElement>) {
    // מקשי עזר / לחצן אמצעי — התנהגות דפדפן רגילה (כרטיסייה חדשה וכו')
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (opening) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      router.push('/books');
      return;
    }

    setOpening(true);
    // מעט אחרי שהדף האחרון סיים להיפרש — שהעין תספיק לקרוא את הפתיחה
    timer.current = window.setTimeout(() => router.push('/books'), 950);
  }

  return (
    <Link
      href="/books"
      onClick={onClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="group inline-flex flex-col items-center gap-3 rounded-[var(--radius-sm)] px-4 pb-2 pt-4 focus-visible:outline-offset-4"
    >
      {/* הבמה: ציר הפתיחה (השדרה) באמצע — הספר הסגור שוכב משמאלו,
          והדפים הנפתחים נפרשים מימינו. הגובה משאיר מקום לדף זקוף באמצע
          התנועה. */}
      <span aria-hidden="true" className="relative block h-24 w-[12.5rem]">
        {/* כריכה תחתונה — נשארת שוכבת */}
        <span className="absolute bottom-0 right-1/2 h-[6px] w-[5.75rem] rounded-l-[3px] bg-gradient-to-t from-navy to-navy-2 shadow-[var(--shadow-soft)]" />

        {/* גוש הדפים — חזית הדפים (fore-edge) כפסים אופקיים דקים */}
        <span
          className="absolute bottom-[6px] right-1/2 h-[23px] w-[5.5rem] rounded-l-[2px] border-y border-cream-3"
          style={{
            background:
              'repeating-linear-gradient(to top, var(--color-cream-3) 0 1px, var(--color-cream) 1px 4px)',
          }}
        />

        {/* הדפים שנפתחים לימין: הכריכה העליונה וכמה דפים בודדים, כל אחד
            על ציר השדרה (origin-right), בזוויות ובהשהיות מדורגות — מניפה. */}
        {FLIP_LEAVES.map((leaf, index) => (
          <span
            key={index}
            className={`absolute right-1/2 origin-right transition-transform duration-700 ease-[var(--ease-soft)] motion-reduce:transition-none ${
              leaf.isCover
                ? 'w-[5.75rem] rounded-l-[3px] bg-gradient-to-b from-navy-2 to-navy shadow-[var(--shadow-soft)]'
                : 'w-[5.5rem] rounded-l-[1px] bg-cream shadow-[0_-1px_0_var(--color-cream-3)]'
            }`}
            style={{
              bottom: `${leaf.bottom}px`,
              height: `${leaf.height}px`,
              transitionDelay: `${leaf.delay}ms`,
              transform: opening
                ? `rotate(${leaf.openAngle}deg)`
                : hovering
                  ? `rotate(${leaf.hoverAngle}deg)`
                  : 'rotate(0deg)',
            }}
          >
            {/* קו זהב עדין על הכריכה בלבד — סימן הספר של המכון */}
            {leaf.isCover ? (
              <span className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-gold/60" />
            ) : null}
          </span>
        ))}

        {/* השדרה — הקצה הימני, נשאר במקומו כשהדפים נפתחים מעליו */}
        <span className="absolute bottom-0 right-1/2 h-[48px] w-[7px] translate-x-1/2 rounded-[2px] border-r border-gold/50 bg-gradient-to-l from-navy to-navy-3" />
      </span>

      <span className="text-small font-semibold text-gold-bright underline-offset-4 transition-colors group-hover:text-gold-bright group-hover:underline">
        {label}
      </span>
    </Link>
  );
}
