'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import HTMLFlipBookDefault from 'react-pageflip';
import { useReducedMotion } from '@/lib/client-hooks';
import { isRtl } from '@/i18n/routing';
import { BookFlipPage, type PreviewPage } from './BookFlipPage';
import { BookFlipDialog } from './BookFlipDialog';
import type { FlipBookComponent, FlipBookRef } from './flip-book-types';

/**
 * הספרייה מצהירה על ה-ref שלה כ-any. ההמרה הזאת היא הנקודה *היחידה*
 * שבה זה נוגע בקוד שלנו — מכאן והלאה הכול מוקלד לפי flip-book-types.ts.
 */
const HTMLFlipBook = HTMLFlipBookDefault as unknown as FlipBookComponent;

/**
 * דפדוף מוחשי בדפי הדוגמה.
 *
 * RTL בלי לשקף תמונות: StPageFlip מניחה סדר מערבי (אינדקס 0 = הכריכה
 * הקדמית, והדף הבא מימין לשמאל). ספר עברי נכרך הפוך. הפתרון כאן הוא
 * להפוך את *סדר המערך* ולהתחיל מהסוף — כך אינדקס הספרייה האחרון הוא
 * עמוד 1 של הספר, וכל spread שהספרייה מציירת נותן את העמוד הנמוך מימין
 * והגבוה משמאל, בדיוק כמו ספר עברי פתוח. אף תמונה אינה עוברת scaleX,
 * ולכן טקסט עברי נשאר קריא.
 *
 * המחיר: כיוון הכפתורים מתהפך מול הספרייה — "הבא" קורא ל-flipPrev.
 * שתי ההמרות (אינדקס וכיוון) מרוכזות כאן ולא מתפזרות ברכיב.
 *
 * prefers-reduced-motion אינו מאט את הקיפול אלא מחליף אותו: מי שביקש
 * להפחית תנועה מקבל תצוגת עמוד יחיד עם כפתורי קודם/הבא, בלי אנימציה
 * בכלל. אותה תצוגה משמשת גם כשיש דף אחד בלבד, שבו אין מה לקפל.
 */
export function BookFlipViewerClient({
  pages,
  title,
  pdfUrl,
  locale,
  onReady,
}: {
  pages: PreviewPage[];
  title: string;
  pdfUrl: string | null;
  locale: string;
  /** נקרא פעם אחת אחרי ה-mount — מודיע ל-BookFlipViewer שאפשר להחליף מהתצוגה הסטטית לדפדוף החי. */
  onReady?: () => void;
}) {
  const t = useTranslations('books');
  const rtl = isRtl(locale);
  const reducedMotion = useReducedMotion();

  const flipBookRef = useRef<FlipBookRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const enlargeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    onReady?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- מדווח פעם אחת ב-mount; onReady לא אמור להשתנות לאורך חיי המופע
  }, []);

  // סדר התצוגה של הספרייה. בעברית — הפוך, ראו הערת הרכיב.
  const orderedPages = useMemo(() => (rtl ? [...pages].reverse() : pages), [pages, rtl]);
  const lastIndex = orderedPages.length - 1;
  const initialIndex = rtl ? lastIndex : 0;

  const [flipIndex, setFlipIndex] = useState(initialIndex);
  const [spread, setSpread] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  /** מיקום הקריאה האנושי (1 = העמוד הראשון של הספר), ללא תלות בכיוון. */
  const readingPosition = rtl ? lastIndex - flipIndex : flipIndex;
  const atStart = readingPosition <= 0;
  const atEnd = readingPosition >= lastIndex;

  const goNext = useCallback(() => {
    const flip = flipBookRef.current?.pageFlip();
    if (!flip) return;
    // בעברית התקדמות בקריאה = ירידה באינדקס הספרייה
    if (rtl) flip.flipPrev();
    else flip.flipNext();
  }, [rtl]);

  const goPrev = useCallback(() => {
    const flip = flipBookRef.current?.pageFlip();
    if (!flip) return;
    if (rtl) flip.flipNext();
    else flip.flipPrev();
  }, [rtl]);

  /** ניווט במקלדת — חץ "קדימה" תלוי בכיוון הכתיבה, לא במקש עצמו. */
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
      if (forward) goNext();
      else goPrev();
    }

    node.addEventListener('keydown', onKeyDown);
    return () => node.removeEventListener('keydown', onKeyDown);
  }, [rtl, goNext, goPrev]);

  if (orderedPages.length === 0) return null;

  const pageLabel = (page: PreviewPage) =>
    t('flipPageAlt', { page: page.pageNumber, title });

  /**
   * המונה מדווח על מה שבאמת מוצג ולא על חשבון אינדקסים.
   *
   * StPageFlip מחזירה ב-onFlip את האינדקס של הדף השמאלי ב-spread. אחרי
   * היפוך הסדר ב-RTL זה דווקא העמוד הגבוה מבין השניים, ולכן חישוב
   * "מיקום + 1" הציג 4 כשעל המסך היו 3 ו-4. במקום זאת נשלפים כאן מספרי
   * העמודים בפועל מתוך המערך המסודר, ומוצג טווח כשיש שני עמודים.
   */
  const visible = spread
    ? [orderedPages[flipIndex], orderedPages[flipIndex + 1]].filter(Boolean)
    : [orderedPages[flipIndex]].filter(Boolean);
  const visibleNumbers = visible.map((page) => page.pageNumber).sort((a, b) => a - b);

  const counter = (
    <span aria-live="polite" className="min-w-28 text-center text-caption text-muted">
      {visibleNumbers.length > 1
        ? t('flipPageRange', {
            from: visibleNumbers[0],
            to: visibleNumbers[visibleNumbers.length - 1],
            total: orderedPages.length,
          })
        : t('pdfPage', { current: visibleNumbers[0] ?? 1, total: orderedPages.length })}
    </span>
  );

  const controls = (
    <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
      <button type="button" onClick={goPrev} disabled={atStart} className="btn btn-quiet">
        {t('pdfPrev')}
      </button>

      {counter}

      <button type="button" onClick={goNext} disabled={atEnd} className="btn btn-quiet">
        {t('pdfNext')}
      </button>

      <button
        ref={enlargeRef}
        type="button"
        onClick={() => setDialogOpen(true)}
        className="btn btn-quiet"
      >
        {t('flipEnlarge')}
      </button>

      {pdfUrl ? (
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-quiet">
          {t('flipOpenPdf')}
        </a>
      ) : null}
    </div>
  );

  return (
    <section
      ref={containerRef}
      tabIndex={-1}
      aria-label={t('flipAriaLabel', { title })}
      className="overflow-hidden rounded-[2rem] border border-rule bg-cream-3/60 px-4 py-8 shadow-[var(--shadow-soft)] sm:px-8 lg:px-12"
    >
      <div className="relative mx-auto flex min-h-[26rem] items-center justify-center sm:min-h-[32rem]">
        <div
          aria-hidden="true"
          className="absolute bottom-3 left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-full bg-black/20 blur-2xl"
        />

        {reducedMotion || orderedPages.length === 1 ? (
          <StaticPage page={orderedPages[flipIndex]} label={pageLabel(orderedPages[flipIndex])} />
        ) : (
          <HTMLFlipBook
            ref={flipBookRef}
            className="book-flip"
            style={{}}
            startPage={initialIndex}
            size="stretch"
            width={460}
            height={640}
            minWidth={260}
            maxWidth={520}
            minHeight={360}
            maxHeight={720}
            drawShadow
            flippingTime={750}
            usePortrait
            startZIndex={0}
            autoSize
            maxShadowOpacity={0.28}
            /* showCover=false במכוון: אלה עמודי *פנים* לדוגמה, לא הכריכה
               (הכריכה חיה ב-Hero). showCover היה מסמן את הדף הראשון
               והאחרון כ"קשים" ומצייר אותם לבדם בחצי המסך — ובעברית,
               אחרי היפוך הסדר, החצי הזה יוצא הצד השגוי. בלעדיו כל
               התצוגה היא spread ממורכז, וזה גם מה שדוגמה אמורה להיראות. */
            showCover={false}
            mobileScrollSupport
            clickEventForward={false}
            useMouseEvents
            swipeDistance={24}
            showPageCorners
            disableFlipByClick={false}
            onFlip={(event) => setFlipIndex(event.data)}
            onChangeOrientation={(event) => setSpread(event.data === 'landscape')}
            /* onChangeOrientation נורה רק כשהכיוון *משתנה*, ולכן מסך רחב
               שנפתח כבר ב-landscape לא היה מדווח עליו כלל והמונה היה
               מציג עמוד בודד במקום טווח. onInit סוגר את הפער. */
            onInit={() =>
              setSpread(flipBookRef.current?.pageFlip()?.getOrientation() === 'landscape')
            }
          >
            {orderedPages.map((page) => (
              <BookFlipPage key={page.id} page={page} label={pageLabel(page)} />
            ))}
          </HTMLFlipBook>
        )}
      </div>

      {/* במצב תנועה מופחתת הכפתורים מזיזים את המצב ישירות, בלי הספרייה */}
      {reducedMotion || orderedPages.length === 1 ? (
        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setFlipIndex((i) => (rtl ? Math.min(lastIndex, i + 1) : Math.max(0, i - 1)))}
            disabled={atStart}
            className="btn btn-quiet"
          >
            {t('pdfPrev')}
          </button>
          {counter}
          <button
            type="button"
            onClick={() => setFlipIndex((i) => (rtl ? Math.max(0, i - 1) : Math.min(lastIndex, i + 1)))}
            disabled={atEnd}
            className="btn btn-quiet"
          >
            {t('pdfNext')}
          </button>
          <button
            ref={enlargeRef}
            type="button"
            onClick={() => setDialogOpen(true)}
            className="btn btn-quiet"
          >
            {t('flipEnlarge')}
          </button>
          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-quiet">
              {t('flipOpenPdf')}
            </a>
          ) : null}
        </div>
      ) : (
        controls
      )}

      {dialogOpen ? (
        <BookFlipDialog
          pages={pages}
          startAt={readingPosition}
          title={title}
          rtl={rtl}
          pdfUrl={pdfUrl}
          onClose={() => {
            setDialogOpen(false);
            enlargeRef.current?.focus();
          }}
        />
      ) : null}
    </section>
  );
}

/** תצוגת עמוד יחיד — למצב תנועה מופחתת ולספר בן דף אחד. */
function StaticPage({ page, label }: { page: PreviewPage; label: string }) {
  return (
    <div className="relative w-full max-w-[32rem] bg-white shadow-[var(--shadow-soft)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- נכס WebP מוכן; ראו BookFlipPage */}
      <img src={page.imageUrl} alt={label} className="h-full w-full object-contain" />
    </div>
  );
}
