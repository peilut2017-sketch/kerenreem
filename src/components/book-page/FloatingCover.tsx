'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useReducedMotion } from '@/lib/client-hooks';

/**
 * הכריכה המרחפת ב-Hero: לא מונחת אלא "צפה" מעל שולחן זכוכית — צל רך
 * מתחתיה, השתקפות עדינה, ונטייה של 2–3 מעלות בלבד לפי מיקום העכבר,
 * כאילו מישהו מחזיק אותה ביד. הכול מבוטל כש-prefers-reduced-motion פעיל.
 *
 * הנטייה מיושמת ישירות על style.transform ולא דרך state של React: אירוע
 * mousemove יורה בקצב גבוה מדי בשביל רינדור מלא בכל פעימה, וזה בדיוק
 * המקרה שה-DOM API הישיר קיים בשבילו.
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
    // עד 3 מעלות בכל ציר — נטייה שמורגשת ולא "אפקט"
    cardRef.current.style.transform = `perspective(1200px) rotateX(${y * -3}deg) rotateY(${x * 3}deg)`;
  }

  function onMouseLeave() {
    if (cardRef.current) cardRef.current.style.transform = '';
  }

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative mx-auto w-full max-w-[15rem] [perspective:1200px]"
    >
      <div
        ref={cardRef}
        className="relative transition-transform duration-300 ease-out will-change-transform"
      >
        <div className="relative aspect-3/4 w-full overflow-hidden rounded-[var(--radius-md)] bg-cream-2 shadow-[0_40px_70px_-30px_rgb(0_0_0_/_0.45)]">
          {src ? (
            // object-contain ולא object-cover: כריכת ספר היא טקסט, וחיתוך
            // בולע את שם הספר (ראו BookCover.tsx לאותו נימוק)
            <Image
              src={src}
              alt={alt}
              fill
              priority
              sizes="(max-width: 1024px) 55vw, 240px"
              className="object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-cream-2 px-4">
              <span className="text-center font-serif text-[0.95rem] leading-snug text-ink-soft">
                {title}
              </span>
            </div>
          )}
        </div>

        {/* השתקפות: רק הרצועה העליונה של הכריכה, הפוכה ודוהה — כאילו
            מונחת על משטח מבריק.

            רצועה ולא עותק מלא. הגרסה הקודמת שכפלה את הכריכה בגובה מלא
            (aspect-3/4) ורק החילה מסכה: זה הכפיל את גובה ה-Hero והצטייר
            כספר שני, כהה וחתוך, תלוי מתחת לראשון — תקלה ולא עידון.
            השתקפות אמיתית על שולחן זכוכית נראית רק סנטימטרים ספורים. */}
        {src ? (
          <div
            aria-hidden="true"
            className="relative mt-1 h-16 w-full overflow-hidden rounded-b-[var(--radius-md)] opacity-[0.18] [mask-image:linear-gradient(to_bottom,black,transparent)]"
          >
            <div className="absolute inset-x-0 top-0 aspect-3/4 [transform:scaleY(-1)]">
              <Image src={src} alt="" fill sizes="240px" className="object-contain object-bottom" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
