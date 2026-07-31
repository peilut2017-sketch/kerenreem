'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

const HTMLFlipBook = dynamic(() => import('react-pageflip'), { ssr: false });

/** עמוד PDF שעבר רינדור לתמונה, מוכן להיות "דף" בספר הדפדוף. */
interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

/** דפים רבים מדי לדפדוף חי הם כבר לא "דוגמה" — עדיף קישור ישיר לקובץ. */
const MAX_PAGES = 40;

/**
 * דפדוף חי מוטמע בכרטיס — לא כפתור שפותח מגירה. הכרך עצמו, עם חצי
 * דפדוף עגולים ופס התקדמות לצדו, ו"מסך מלא" הוא הגדלה של אותו מופע
 * (Fullscreen API על אותו מכל) ולא עותק שני — כך שהעמוד הנוכחי לא
 * מאבד את מקומו במעבר.
 *
 * הרינדור של pdf.js קורה רק בלחיצה על "פתיחת דוגמה", לא בטעינת העמוד:
 * pdf.js הוא ספרייה כבדה, וספר שאין בו דוגמה, או שהמבקר לא מתעניין
 * בדפדוף, לא אמור לשלם את המחיר שלה בכלל.
 *
 * ה-worker של pdf.js נטען מ-URL סטטי שה-bundler עצמו פותר (new URL +
 * import.meta.url) — לא מהעתקה ידנית ל-public, שהייתה נשברת בשקט בכל
 * שדרוג גרסה של pdfjs-dist.
 *
 * useTranslations ולא t כ-prop: רכיב לקוח אמיתי, ו-t שנוצר בשרת אינו
 * ניתן להעברה כ-prop לרכיב כזה (React זורק בזמן ריצה, לא רק אזהרת טיפוסים).
 */
export function PdfFlipbook({ pdfUrl, title }: { pdfUrl: string; title: string }) {
  const t = useTranslations('books');
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // react-pageflip אינו מייצא טיפוס ל-instance שה-ref מחזיק — ראו ה-@ts-expect-error למטה
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookRef = useRef<any>(null);

  useEffect(() => {
    function onChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  async function load() {
    if (loadedFor.current === pdfUrl) return;

    setLoading(true);
    setError(null);
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString();

      const doc = await pdfjsLib.getDocument(pdfUrl).promise;
      const pageCount = Math.min(doc.numPages, MAX_PAGES);
      const rendered: RenderedPage[] = [];

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        const pdfPage = await doc.getPage(pageNumber);
        const viewport = pdfPage.getViewport({ scale: 1.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) continue;

        await pdfPage.render({ canvasContext: context, viewport }).promise;
        rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height });
      }

      loadedFor.current = pdfUrl;
      setPages(rendered);
    } catch (err) {
      console.error('[PdfFlipbook]', err);
      setError(t('flipbookError'));
    } finally {
      setLoading(false);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void containerRef.current?.requestFullscreen();
    }
  }

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? 'flex h-full w-full flex-col items-center justify-center gap-5 bg-navy p-6'
          : ''
      }
    >
      {!pages ? (
        loading ? (
          <p role="status" className="py-16 text-center text-small text-muted">
            …
          </p>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-small text-burgundy">{error}</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="link mt-3 inline-block text-small">
              {pdfUrl}
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void load()}
            className="flex min-h-56 w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-rule-strong bg-cream-2/60 px-6 py-10 text-center transition-colors hover:border-gold-deep"
          >
            <span className="icon-chip h-11 w-11">
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 3.5h8l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z" />
                <path d="M12 3.5v4h4" />
              </svg>
            </span>
            <span className="text-small font-medium text-ink">{t('sample')}</span>
          </button>
        )
      ) : (
        <>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
              disabled={page <= 0}
              aria-label={t('pdfPrev')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule bg-cream text-ink-soft transition-colors hover:border-gold-deep disabled:opacity-40"
            >
              ‹
            </button>

            <div className="mx-auto flex justify-center">
              {/* @ts-expect-error -- react-pageflip's public types don't model children/style precisely */}
              <HTMLFlipBook
                ref={bookRef}
                width={pages[0].width}
                height={pages[0].height}
                size="stretch"
                minWidth={200}
                maxWidth={fullscreen ? 640 : 340}
                minHeight={260}
                maxHeight={fullscreen ? 860 : 460}
                showCover
                onFlip={(event: { data: number }) => setPage(event.data)}
                className="shadow-[var(--shadow-float)]"
              >
                {pages.map((pdfPage, index) => (
                  <div key={index} className="bg-cream">
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL מקומי שכבר בזיכרון, לא נכס שמתאים לאופטימיזציה של next/image */}
                    <img src={pdfPage.dataUrl} alt="" className="h-full w-full object-contain" />
                  </div>
                ))}
              </HTMLFlipBook>
            </div>

            <button
              type="button"
              onClick={() => bookRef.current?.pageFlip()?.flipNext()}
              disabled={page >= pages.length - 1}
              aria-label={t('pdfNext')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule bg-cream text-ink-soft transition-colors hover:border-gold-deep disabled:opacity-40"
            >
              ›
            </button>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="shrink-0 text-caption text-muted">{t('pdfPage', { current: page + 1, total: pages.length })}</span>
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-cream-3">
              <span
                className="block h-full rounded-full bg-gold-deep transition-[width] duration-300"
                style={{ width: `${((page + 1) / pages.length) * 100}%` }}
              />
            </span>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="shrink-0 rounded-[var(--radius-md)] border border-rule bg-cream px-3.5 py-1.5 text-caption text-ink-soft transition-colors hover:border-gold-deep"
            >
              {fullscreen ? t('pdfExitFullscreen') : t('pdfOpenFullscreen')}
            </button>
          </div>

          {fullscreen ? <p className="text-caption text-cream-2/70">{title}</p> : null}
        </>
      )}
    </div>
  );
}
