'use client';

import { useEffect, useRef, useState } from 'react';
import { Link, useRouter } from '@/i18n/navigation';

/**
 * [1.30] לחצן "לכל הספרים" — ספר שוכב שנפתח.
 *
 * במקום קישור טקסט, הלחצן הוא ספר קטן ששוכב על גבו (הטיה תלת-ממדית של
 * rotateX עם perspective). לחיצה מדמה את פתיחת הספר: הכריכה הקדמית
 * מסתובבת סביב השדרה (בצד ימין — ספר עברי נפתח מימין), נגלה עמוד פנימי,
 * ורק אז מתבצע המעבר לעמוד כל הספרים — כך האנימציה נקראת כ"נכנסים אל
 * תוך הספר".
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
    // מעט אחרי סוף אנימציית הכריכה (700ms) — שהעין תספיק לקרוא את הפתיחה
    timer.current = window.setTimeout(() => router.push('/books'), 750);
  }

  return (
    <Link
      href="/books"
      onClick={onClick}
      aria-label={label}
      className="group inline-block rounded-[var(--radius-sm)] px-6 pb-2 pt-8 focus-visible:outline-offset-4"
    >
      <span className="block [perspective:900px]">
        <span
          className={`relative block h-32 w-24 transition-transform duration-500 ease-[var(--ease-spring)] [transform-style:preserve-3d] motion-reduce:transition-none ${
            opening
              ? '[transform:rotateX(38deg)_rotateZ(0deg)]'
              : '[transform:rotateX(56deg)_rotateZ(-7deg)] group-hover:[transform:rotateX(46deg)_rotateZ(-3deg)] group-focus-visible:[transform:rotateX(46deg)_rotateZ(-3deg)]'
          }`}
        >
          {/* גוש הדפים — נגלה כשהכריכה נפתחת */}
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-[4px] rounded-e-[2px] border border-rule-strong bg-cream shadow-[var(--shadow-lift)]"
          >
            <span className="absolute inset-x-3 top-4 flex flex-col gap-2">
              <span className="h-px bg-rule" />
              <span className="h-px bg-rule" />
              <span className="h-px w-3/4 bg-rule" />
            </span>
            <span className="absolute inset-x-0 bottom-5 text-center font-serif text-caption font-bold text-ink">
              {label} ←
            </span>
          </span>

          {/* הכריכה הקדמית — ציר הסיבוב על השדרה שבצד ימין */}
          <span
            className={`absolute inset-0 origin-right transition-transform duration-700 ease-[var(--ease-soft)] [transform-style:preserve-3d] motion-reduce:transition-none ${
              opening ? '[transform:rotateY(165deg)]' : '[transform:rotateY(0deg)]'
            }`}
          >
            {/* פני הכריכה */}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[4px] rounded-e-[2px] border border-gold/60 bg-gradient-to-l from-navy-2 to-navy px-2 text-center shadow-[var(--shadow-soft)] [backface-visibility:hidden]">
              <span aria-hidden="true" className="h-px w-10 bg-gold/70" />
              <span className="font-serif text-small font-bold leading-snug text-gold-bright">
                {label}
              </span>
              <span aria-hidden="true" className="h-px w-10 bg-gold/70" />
            </span>
            {/* גב הכריכה — נראה בזמן הפתיחה */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[4px] rounded-s-[2px] border border-rule-strong bg-cream-2 [backface-visibility:hidden] [transform:rotateY(180deg)]"
            />
          </span>
        </span>
      </span>
    </Link>
  );
}
