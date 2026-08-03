'use client';

import { Img as Image } from '@/components/Img';
import { useCallback, useId, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { Banner } from '@/lib/supabase/types';

/** מיפוי נקודת המיקוד למחלקת object-position. */
const FOCAL_CLASS: Record<string, string> = {
  center: 'object-center',
  top: 'object-top',
  bottom: 'object-bottom',
  start: 'object-right',
  end: 'object-left',
};

/**
 * רצועת הבאנרים בראש עמוד הבית.
 *
 * הבאנר הוא התמונה, ותו לא. אין כיתוב מעליו: הטקסט כבר מעוצב בתוך התמונה
 * שהצוות הכין, וכותרת שמונחת מעליה מתנגשת איתו ומכסה חלק מהעיצוב.
 *
 * הכותרת שהוגדרה בניהול עדיין עובדת קשה — היא ה-alt של התמונה. כך קורא
 * מסך מקבל את תוכן הבאנר, שאחרת היה אובד לגמרי: תמונה בלי alt היא באנר
 * שלא קיים עבור מי שאינו רואה אותו.
 *
 * החצים מופיעים בקרבת העכבר בלבד, כדי שלא יחצצו בין המבקר לתמונה. הם
 * מופיעים גם ב-focus-within — משתמש מקלדת אינו יכול "להתקרב עם העכבר",
 * ופקד שנגלה רק ב-hover אינו קיים עבורו.
 */
export function BannerStrip({
  banners,
  locale,
  label,
}: {
  banners: Banner[];
  locale: string;
  label: string;
}) {
  const [index, setIndex] = useState(0);
  const id = useId();

  const count = banners.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  if (count === 0) return null;

  const active = banners[index];
  const alt = (locale === 'en' && active.title_en ? active.title_en : active.title_he) ?? '';
  const href = active.link_url;

  const image = (
    <>
      {/* גרסת נייד נפרדת כשהועלתה: קידוד תמונה רחבה למסך צר חותך את מרכז
          העניין, ו-picture נותן לדפדפן לבחור לפני ההורדה. */}
      {active.image_mobile_url ? (
        <picture>
          <source media="(min-width: 768px)" srcSet={active.image_url ?? ''} />
          <img src={active.image_mobile_url} alt={alt} className="h-full w-full object-cover" />
        </picture>
      ) : active.image_url ? (
        <Image
          src={active.image_url}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className={`object-cover ${FOCAL_CLASS[active.focal_point ?? 'center']}`}
        />
      ) : null}
    </>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      // margin-top שלילי בגובה ה-header (--site-header-h, ראו
      // SiteHeaderHeightVar) מושך את הבאנר מתחת לניווט הצף — הוא מתחיל
      // מראש העמוד ממש, וה-header מרחף שקוף מעליו במקום לתפוס שורה
      // משלו. הרוחב (w/max-w) חוזר בדיוק על מבנה ה-header (px-3/sm:px-5
      // עד max-w-[82rem]) כדי ששני הרצועות ייראו כמעט באותו רוחב.
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          go(index + 1);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          go(index - 1);
        }
      }}
      className="group relative isolate mx-auto mt-[calc(-1*var(--site-header-h,4.75rem))] w-[calc(100%-1.5rem)] max-w-[82rem] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-float)] sm:mt-[calc(-1*var(--site-header-h,5.5rem))] sm:w-[calc(100%-2.5rem)]"
    >
      {/* היחס נשמר בין המסכים כדי שהבאנר לא ייחתך בגובה משתנה */}
      <div className="relative aspect-4/5 w-full sm:aspect-16/7">
        {/* ההחלפה יזומה תמיד, ולכן בטוח להכריז עליה */}
        <div aria-live="polite" aria-atomic="true" className="absolute inset-0">
          {href ? (
            href.startsWith('http') ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 block"
              >
                {image}
              </a>
            ) : (
              <Link href={href} className="absolute inset-0 block">
                {image}
              </Link>
            )
          ) : (
            image
          )}
        </div>
      </div>

      {count > 1 ? (
        <>
          <Arrow side="start" onClick={() => go(index - 1)} label="הבאנר הקודם" />
          <Arrow side="end" onClick={() => go(index + 1)} label="הבאנר הבא" />

          {/* מחווני מיקום — מופיעים יחד עם החצים ובאותו תנאי */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="glass-dark pointer-events-auto flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-2">
              {banners.map((banner, position) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => go(position)}
                  aria-label={`מעבר לבאנר ${position + 1} מתוך ${count}`}
                  aria-current={position === index ? 'true' : undefined}
                  className={`h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-spring)] ${
                    position === index ? 'w-7 bg-gold' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        באנר {index + 1} מתוך {count}
      </span>
    </section>
  );
}

function Arrow({
  side,
  onClick,
  label,
}: {
  side: 'start' | 'end';
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`glass-dark absolute top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-[var(--radius-pill)] text-white/85 opacity-0 transition-[opacity,transform,color] duration-300 ease-[var(--ease-spring)] group-hover:opacity-100 group-focus-within:opacity-100 hover:scale-105 hover:text-gold focus-visible:opacity-100 motion-reduce:transition-none ${
        side === 'start' ? 'start-3 lg:start-6' : 'end-3 lg:end-6'
      }`}
    >
      {/* החץ מצביע תמיד החוצה, אל צדו שלו. הצורה משורטטת ל-LTR ומתהפכת
          בעברית, אחרת "הקודם" בצד ימין היה מצביע פנימה. */}
      <svg viewBox="0 0 20 20" className="h-5 w-5 rtl:-scale-x-100" fill="none" aria-hidden="true">
        <path
          d={side === 'start' ? 'M12 4l-6 6 6 6' : 'M8 4l6 6-6 6'}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
