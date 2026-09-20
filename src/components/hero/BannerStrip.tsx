'use client';

import { Img as Image } from '@/components/Img';
import { useCallback, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { toCdnUrl } from '@/lib/image-src';
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
  const t = useTranslations('hero');
  const [index, setIndex] = useState(0);
  const id = useId();

  const count = banners.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  if (count === 0) return null;

  const active = banners[index];
  const alt = (locale === 'en' && active.title_en ? active.title_en : active.title_he) ?? '';
  // הגנת עומק בנוסף לוולידציה בשמירה (saveEntity): רק נתיב פנימי או
  // http(s) — ערך אחר (למשל javascript:) שנשמר לפני הוולידציה לא יהפוך
  // ללחיץ. באנר עם יעד פסול פשוט אינו קישור.
  const rawHref = active.link_url;
  const href = rawHref && /^(https?:\/\/|\/)/i.test(rawHref) ? rawHref : null;

  const image = (
    <>
      {/* גרסת נייד נפרדת כשהועלתה: picture נותן לדפדפן לבחור לפני ההורדה.
          object-contain בנייד — לא חותך: כל התמונה מוצגת, פשוט קטנה
          יותר. ב-sm ומעלה חוזרים ל-cover, כדי שהבאנר הרחב ימלא את
          הרצועה כרגיל. */}
      {active.image_mobile_url ? (
        <picture>
          <source media="(min-width: 640px)" srcSet={active.image_url ? toCdnUrl(active.image_url) : ''} />
          <img
            src={toCdnUrl(active.image_mobile_url)}
            alt={alt}
            className="h-full w-full object-contain sm:object-cover"
          />
        </picture>
      ) : active.image_url ? (
        <Image
          src={active.image_url}
          alt={alt}
          fill
          priority
          sizes="100vw"
          className={`object-contain sm:object-cover sm:${FOCAL_CLASS[active.focal_point ?? 'center']}`}
        />
      ) : null}
    </>
  );

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      // הבאנר מתחיל אחרי פס הניווט, עם מרווח — לא מתחתיו. הרוחב
      // (w/max-w) חוזר על מבנה תוכן ה-header (max-w-[82rem]) כדי
      // ששניהם יתיישרו לאותם קצוות.
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        // "הבא" לפי כיוון הממשק (ראו HeroCarousel)
        const rtl = document.documentElement.dir === 'rtl';
        const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
        event.preventDefault();
        go(forward ? index + 1 : index - 1);
      }}
      className="group relative isolate mx-auto mt-5 w-[calc(100%-2.5rem)] max-w-[82rem] overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-float)] sm:mt-7 sm:w-[calc(100%-4rem)]"
    >
      {/* אותו יחס גובה-רוחב בכל המסכים — אותה תמונה משמשת לשניהם (ראו
          object-contain למעלה), אז הרצועה עצמה נשארת ברוחב הרחב
          המומלץ בניהול, ופשוט קטנה יותר על מסך צר. */}
      <div className="relative aspect-16/7 w-full">
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
          <Arrow side="start" onClick={() => go(index - 1)} label={t('prevBanner')} />
          <Arrow side="end" onClick={() => go(index + 1)} label={t('nextBanner')} />

          {/* מחווני מיקום — מופיעים יחד עם החצים ובאותו תנאי */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
            <div className="glass-dark pointer-events-auto flex items-center gap-2 rounded-[var(--radius-pill)] px-3 py-2">
              {banners.map((banner, position) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => go(position)}
                  aria-label={t('goToBanner', { position: position + 1, count })}
                  aria-current={position === index ? 'true' : undefined}
                  className={`relative h-1.5 rounded-full transition-all duration-500 ease-[var(--ease-spring)] before:absolute before:-inset-2.5 before:content-[''] ${
                    position === index ? 'w-7 bg-gold' : 'w-1.5 bg-white/50 hover:bg-white/80'
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <span id={`${id}-status`} className="sr-only" aria-live="polite">
        {t('bannerCounter', { position: index + 1, count })}
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
