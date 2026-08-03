'use client';

import { useRef } from 'react';
import { Img as Image } from '@/components/Img';
import { useReducedMotion } from '@/lib/client-hooks';

/**
 * הכריכה ב-Hero כספר עומד, לא כתמונה שטוחה.
 *
 * שלושה רכיבים יוצרים את התחושה הפיזית: פאת שדרה צרה בקצה (עובי הכרך),
 * שכבת ברק אלכסונית על הכריכה (אור שנופל על חומר), וצל קרקע אליפטי
 * מתחת — הספר עומד על משטח, לא מרחף בחלל ריק.
 *
 * השדרה בימין *פיזי* ולא ב-start הלוגי: ספר עברי נפתח משמאל לימין,
 * כלומר השדרה בימין — וזה נשאר נכון גם כשהממשק מוצג באנגלית (הכריכות
 * עצמן עבריות בכל מקרה). start לוגי היה מעביר אותה לשמאל ב-LTR ויוצר
 * ספר הפוך. הסיבוב שלילי כדי שהצד הימני יתקדם אל הצופה ותיראה השדרה.
 *
 * הנטייה מיושמת ישירות על style.transform ולא דרך state של React: אירוע
 * mousemove יורה בקצב גבוה מדי בשביל רינדור מלא בכל פעימה, וזה בדיוק
 * המקרה שה-DOM API הישיר קיים בשבילו. הכול מבוטל ב-prefers-reduced-motion.
 */
export function FloatingCover({
  src,
  title,
  alt,
}: {
  src: string | null;
  title: string;
  alt: string;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion || !wrapperRef.current || !cardRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    // סביב הנטייה הבסיסית, לא במקומה — עד 3 מעלות לכל כיוון
    cardRef.current.style.transform = `rotateX(${y * -3}deg) rotateY(${-7 + x * 3}deg)`;
  }

  function onMouseLeave() {
    if (cardRef.current) cardRef.current.style.transform = '';
  }

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative mx-auto w-full max-w-[19rem] [perspective:1400px] lg:max-w-[25rem]"
    >
      <div
        ref={cardRef}
        className="relative [transform:rotateY(-7deg)] [transform-style:preserve-3d] transition-transform duration-500 ease-out will-change-transform motion-reduce:transform-none motion-reduce:transition-none"
      >
        <div className="relative aspect-3/4 w-full">
          {/* פאת השדרה — רצועה צרה בקצה שנותנת לכרך עובי */}
          <div
            aria-hidden="true"
            className="absolute inset-y-[1.5%] right-[-1.3rem] w-[1.4rem] rounded-r-[3px] bg-gradient-to-r from-black/45 via-black/28 to-black/40 shadow-[0_18px_30px_-12px_rgb(0_0_0_/_0.5)]"
          />

          <div className="relative h-full w-full overflow-hidden rounded-[3px] rounded-r-[6px] bg-cream-2 shadow-[0_30px_60px_-24px_rgb(11_21_32_/_0.55)]">
            {src ? (
              // object-contain ולא object-cover: כריכת ספר היא טקסט, וחיתוך
              // בולע את שם הספר (ראו BookCover.tsx לאותו נימוק)
              <Image
                src={src}
                alt={alt}
                fill
                priority
                sizes="(max-width: 1024px) 60vw, 400px"
                className="object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-cream-2 px-5">
                <span className="text-center font-serif text-lead leading-snug text-ink-soft">
                  {title}
                </span>
              </div>
            )}

            {/* ברק: אור אלכסוני חלש על פני החומר */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,rgb(255_255_255_/_0.16)_47%,transparent_56%)]"
            />
          </div>
        </div>
      </div>

      {/* צל הקרקע: אליפסה רכה מתחת לכרך, כדי שיעמוד ולא ירחף */}
      <div
        aria-hidden="true"
        className="mx-auto mt-5 h-6 w-[78%] rounded-[50%] bg-navy/25 blur-xl"
      />
    </div>
  );
}
