'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { DirArrow } from '@/components/DirArrow';

/**
 * [1.30, עודכן 1.38] לחצן "לכל הספרים" — ספר שוכב, במבט מהצד ממש.
 *
 * הספר שוכב סגור על גבו ורואים רק את הפרופיל שלו, בגובה העין של השולחן:
 * כריכה תחתונה, גוש הדפים (פסים דקים — קצות הדפים), כריכה עליונה, והשדרה
 * המעוגלת בצד ימין (ספר עברי — השדרה מימין). לחיצה פותחת אותו: הכריכה
 * העליונה ושלושה "עלים" מתרוממים סביב השדרה ונפרשים ימינה, בהפרש קטן
 * זה מזה כמניפת דפים, ורק אז מתבצע המעבר לעמוד כל הספרים — כך האנימציה
 * נקראת כ"נכנסים אל תוך הספר".
 *
 * צירי הסיבוב פיזיים (origin-right, right-0) ולא לוגיים: השדרה של ספר
 * עברי נמצאת מימין גם כשהממשק באנגלית.
 *
 * נגישות: זהו <a> אמיתי אל /books — קליק עם מקש עזר (פתיחה בכרטיסייה
 * חדשה), קורא מסך או כשל JS מנווטים כרגיל; ומי שביקש reduced-motion
 * מנווט מיד, בלי ההשהיה של האנימציה.
 */
export function AllBooksBook({ label }: { label: string }) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
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
    // מעט אחרי שהעלה האחרון נפרש (700ms + השהיות) — שהעין תספיק לקרוא את הפתיחה
    timer.current = window.setTimeout(() => router.push('/books'), 850);
  }

  /**
   * העלים שנפרשים: זווית סופית וההשהיה של כל אחד. הכריכה נפתחת הכי רחוק
   * (כמעט שוכבת מימין), והדפים אחריה נעצרים בזוויות הולכות וקטנות —
   * כמו מניפה. רוטציה חיובית (עם כיוון השעון על המסך) סביב הקצה הימני
   * מרימה את הקצה השמאלי החופשי ומעבירה אותו מעל השדרה ימינה — כמו מחוג
   * שעון שעולה מ-9 דרך 12 לכיוון 3.
   */
  const leaves = [
    { top: 'top-[5px]', open: '[transform:rotateZ(150deg)]', delay: 'delay-75' },
    { top: 'top-[9px]', open: '[transform:rotateZ(110deg)]', delay: 'delay-150' },
    { top: 'top-[13px]', open: '[transform:rotateZ(70deg)]', delay: 'delay-200' },
  ];

  return (
    <Link
      href="/books"
      onClick={onClick}
      aria-label={label}
      className="group inline-flex flex-col items-center gap-3 rounded-[var(--radius-sm)] px-8 pb-2 pt-6 focus-visible:outline-offset-4"
    >
      {/* הבמה: פרופיל הספר. overflow גלוי — הכריכה הנפתחת יוצאת מגבולותיה ימינה ולמעלה. */}
      <span aria-hidden="true" className="relative block h-9 w-40">
        {/* צל על "השולחן" */}
        <span className="absolute -bottom-1 inset-x-2 h-2 rounded-[50%] bg-navy/20 blur-[3px]" />

        {/* כריכה תחתונה */}
        <span className="absolute inset-x-0 bottom-0 h-[5px] rounded-l-[2px] bg-navy" />

        {/* גוש הדפים — פסי קצות הדפים */}
        <span className="absolute bottom-[5px] left-[3px] right-[6px] top-[5px] border-y border-rule-strong bg-cream-2 [background-image:repeating-linear-gradient(to_bottom,transparent_0,transparent_2px,rgb(20_18_14/0.09)_2px,rgb(20_18_14/0.09)_3px)]" />

        {/* עלים שנפרשים ימינה, במניפה */}
        {leaves.map((leaf) => (
          <span
            key={leaf.top}
            className={`absolute left-[3px] right-[6px] ${leaf.top} h-[3px] origin-right border-t border-rule-strong bg-cream transition-transform duration-700 ease-[var(--ease-soft)] motion-reduce:transition-none ${leaf.delay} ${
              opening ? leaf.open : '[transform:rotateZ(0deg)]'
            }`}
          />
        ))}

        {/* כריכה עליונה — נפתחת ראשונה והכי רחוק; במעבר עכבר מתרוממת מעט, כרמז */}
        <span
          className={`absolute inset-x-0 top-0 h-[5px] origin-right rounded-l-[2px] bg-navy transition-transform duration-700 ease-[var(--ease-soft)] motion-reduce:transition-none ${
            opening
              ? '[transform:rotateZ(165deg)]'
              : '[transform:rotateZ(0deg)] group-hover:[transform:rotateZ(14deg)] group-focus-visible:[transform:rotateZ(14deg)]'
          }`}
        />

        {/* השדרה — קצה מעוגל מימין, עם קו זהב דק */}
        <span className="absolute inset-y-0 right-0 w-[7px] rounded-r-[4px] border-l border-gold/60 bg-navy-2" />
      </span>

      <span className="font-serif text-small font-bold text-ink transition-colors group-hover:text-burgundy group-focus-visible:text-burgundy">
        {label} <DirArrow />
      </span>
    </Link>
  );
}
