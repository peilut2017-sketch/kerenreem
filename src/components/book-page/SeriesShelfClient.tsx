'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { Spine, type ShelfBook } from '@/components/home/BookShelf';

export interface SeriesShelfVolume {
  id: string;
  slug: string;
  title: string;
  /** מספר הכרך כפי שיוצג (י״ד בעברית, 14 באנגלית); ריק לכרך בלי מיקום. */
  positionLabel: string | null;
  /** "כרך י״ד" — לשם הנגיש של השדרה. */
  volumeLabel: string | null;
  /** "מעבר לכרך י״ד" — לנקודת הקפיצה שמתחת למדף. */
  jumpLabel: string;
  spineUrl: string | null;
  spineBase: string;
  spineEdge: string;
  isCurrent: boolean;
}

/**
 * [1.39] המדף עצמו — רכיב לקוח, כי המדף חי על גלילה:
 *
 *  • הכרך שלפניכם ממורכז ברגע הטעינה (ובכל שינוי רוחב), בחישוב הפרש
 *    בין מרכזו למרכז המגלל — ולא scrollIntoView, שגורר גם את העמוד
 *    כולו אל המדף, ושמתנהג אחרת ב-RTL בין דפדפנים.
 *  • scroll-snap מעגן כל שדרה למרכז בסוף החלקה; מסכת שקיפות בקצוות
 *    (mask-image) רומזת שיש עוד מעבר לשוליים.
 *  • חיצים בקצוות רק למי שיש לו עכבר ([@media(hover:hover)]) — במגע
 *    ההחלקה עצמה היא הניווט, וחץ שמכסה שדרה רק מפריע לאגודל.
 *  • הנקודות מתחת למדף קופצות לכרך; הכיתוב "כרך ו׳ מתוך י״ד · סוכה"
 *    קבוע ואינו תלוי במה שרואים — שם ארוך שנחתך על השדרה תמיד נקרא כאן.
 *  • מקלדת: Tab בין הכרכים כקישורים רגילים, וחיצים ימין/שמאל בתוך
 *    המדף מדפדפים ומרכזים.
 *
 * reduced-motion: כל הגלילות מיידיות במקום חלקות, וההרמה בריחוף כבויה
 * (motion-reduce) — אין כאן שום תנועה שאינה יזומה.
 */
export function SeriesShelfClient({
  volumes,
  labels,
}: {
  volumes: SeriesShelfVolume[];
  labels: { shelf: string; current: string; prev: string; next: string; position: string; currentTitle: string };
}) {
  const scroller = useRef<HTMLOListElement>(null);

  const behavior = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';

  /** מרכז את הפריט ה-index-י במגלל — לפי הפרש מרכזים, בלי לגרור את העמוד. */
  const centerItem = useCallback((index: number, smooth: boolean) => {
    const list = scroller.current;
    const item = list?.children[index] as HTMLElement | undefined;
    if (!list || !item) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const delta = itemRect.left + itemRect.width / 2 - (listRect.left + listRect.width / 2);
    list.scrollBy({ left: delta, behavior: smooth ? behavior() : 'instant' });
  }, []);

  const currentIndex = Math.max(
    0,
    volumes.findIndex((volume) => volume.isCurrent),
  );

  useEffect(() => {
    centerItem(currentIndex, false);
    const onResize = () => centerItem(currentIndex, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [centerItem, currentIndex]);

  const page = (direction: 1 | -1) => {
    const list = scroller.current;
    if (!list) return;
    // ב-RTL הכרכים הבאים נמצאים משמאל — scrollBy שלילי מתקדם בסדרה.
    list.scrollBy({ left: -direction * list.clientWidth * 0.6, behavior: behavior() });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLOListElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const items = [...(scroller.current?.querySelectorAll<HTMLElement>('[data-volume]') ?? [])];
    const focused = items.indexOf(document.activeElement as HTMLElement);
    if (focused < 0) return;
    event.preventDefault();
    // ב-RTL חץ שמאלה = הכרך הבא
    const next = event.key === 'ArrowLeft' ? Math.min(items.length - 1, focused + 1) : Math.max(0, focused - 1);
    items[next].focus({ preventScroll: true });
    centerItem(next, true);
  };

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => page(-1)}
          aria-label={labels.prev}
          className="glass absolute -start-1 top-[4.25rem] z-10 hidden h-9 w-9 place-items-center rounded-[var(--radius-pill)] text-ink-soft transition-colors hover:text-burgundy [@media(hover:hover)]:grid"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
            <path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => page(1)}
          aria-label={labels.next}
          className="glass absolute -end-1 top-[4.25rem] z-10 hidden h-9 w-9 place-items-center rounded-[var(--radius-pill)] text-ink-soft transition-colors hover:text-burgundy [@media(hover:hover)]:grid"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
            <path d="m12 5-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <ol
          ref={scroller}
          aria-label={labels.shelf}
          onKeyDown={onKeyDown}
          // pb-8 ולא pb-2: overflow-x:auto גורר overflow-y:auto, ותווית "הספר שלפניכם"
          // שמתחת לשדרה הנוכחית (top-full) חייבת להישאר בתוך גובה המגלל — אחרת היא נחתכת.
          className="flex snap-x snap-proximity items-end gap-1 overflow-x-auto px-3 pb-8 pt-5 [mask-image:linear-gradient(to_right,transparent,#000_2.5rem,#000_calc(100%-2.5rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {volumes.map((volume) => {
            const book: ShelfBook = {
              slug: volume.slug,
              title: volume.title,
              author: null,
              coverUrl: null,
              coverAlt: '',
              spineUrl: volume.spineUrl,
              spineBase: volume.spineBase,
              spineEdge: volume.spineEdge,
            };
            const accessibleName = volume.volumeLabel ? `${volume.volumeLabel} — ${volume.title}` : volume.title;
            const box = (
              <span
                className={`block overflow-hidden rounded-[3px_3px_2px_2px] shadow-[var(--shadow-soft)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-spring)] group-hover:-translate-y-1.5 group-hover:shadow-[var(--shadow-lift)] group-focus-visible:-translate-y-1.5 motion-reduce:transition-none ${
                  volume.isCurrent
                    ? 'h-40 w-12 outline outline-2 outline-offset-2 outline-gold'
                    : 'h-36 w-10'
                }`}
              >
                <Spine book={book} />
              </span>
            );

            return (
              <li key={volume.id} className="relative shrink-0 snap-center">
                {volume.isCurrent ? (
                  <span
                    data-volume
                    tabIndex={-1}
                    aria-current="page"
                    aria-label={`${accessibleName} — ${labels.current}`}
                    className="group block cursor-default"
                  >
                    {box}
                    <span
                      aria-hidden="true"
                      className="absolute -inset-x-10 top-full mt-2 whitespace-nowrap text-center text-caption font-semibold text-gold-deep"
                    >
                      {labels.current}
                    </span>
                  </span>
                ) : (
                  <Link
                    data-volume
                    href={`/books/${volume.slug}`}
                    aria-label={accessibleName}
                    title={volume.title}
                    className="group block rounded-[3px] focus-visible:outline-offset-4"
                  >
                    {box}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        {/* קרש המדף */}
        <div
          aria-hidden="true"
          className="mx-1 mt-1 h-2.5 rounded-[2px] bg-gradient-to-b from-rule-strong to-[color-mix(in_srgb,var(--color-rule-strong)_60%,var(--color-ink))] shadow-[0_10px_18px_-10px_rgb(11_21_32/0.35)]"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="font-serif text-[1.0625rem] text-ink">
          {labels.position}
          <span className="ms-2 font-sans text-caption text-muted">
            {labels.currentTitle} · {labels.current}
          </span>
        </p>
        {volumes.length > 1 ? (
          <ul aria-label={labels.shelf} className="flex max-w-full flex-wrap gap-1">
            {volumes.map((volume, index) => (
              <li key={volume.id}>
                <button
                  type="button"
                  onClick={() => centerItem(index, true)}
                  aria-label={volume.jumpLabel}
                  aria-current={volume.isCurrent ? 'true' : undefined}
                  className={`block h-2.5 w-2.5 rounded-full transition-transform ${
                    volume.isCurrent ? 'scale-125 bg-gold-deep' : 'bg-rule-strong hover:bg-navy-3'
                  }`}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
