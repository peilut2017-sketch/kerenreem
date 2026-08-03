'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion } from 'motion/react';
import { useReducedMotion } from '@/lib/client-hooks';
import { isRtl } from '@/i18n/routing';

/** עמוד PDF שעבר רינדור לתמונה. */
interface RenderedPage {
  dataUrl: string;
  width: number;
  height: number;
}

/** דפים רבים מדי לדוגמה חיה כבר אינם "דוגמה" — עדיף קישור ישיר לקובץ. */
const MAX_PAGES = 40;
const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2];

/**
 * דפדוף דוגמה נגיש — לא הדמיית קיפול דף פיזי.
 *
 * המפרט אוסר במפורש "אנימציית דפדוף מוגזמת המדמה ספר פיזי": הכרטיס
 * המוטמע מציג עמוד אחד עם מעברי Crossfade, וה"מסך מלא" הוא Dialog אמיתי
 * (לא Fullscreen API על אותו רכיב) עם Focus Trap, Escape, זום והתאמה
 * לרוחב — ובו בלבד, כשיש מקום, נראה שני עמודים זה לצד זה כמו פתיחה של
 * ספר אמיתי.
 *
 * pdf.js נטען רק בלחיצה על "דוגמה" — לא בטעינת העמוד — כי ספר בלי
 * דוגמה, או מבקר שלא מתעניין, לא אמור לשלם את המחיר של ספרייה כבדה.
 */
export function BookSampleViewer({
  pdfUrl,
  title,
  locale,
}: {
  pdfUrl: string;
  title: string;
  /** לצורך סדר ה-Spread ב-Dialog: בעברית העמוד הימני הוא הראשון בזוג. */
  locale: string;
}) {
  const t = useTranslations('books');
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();

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
        rendered.push({
          dataUrl: canvas.toDataURL('image/jpeg', 0.85),
          width: viewport.width,
          height: viewport.height,
        });
      }

      loadedFor.current = pdfUrl;
      setPages(rendered);
    } catch (err) {
      console.error('[BookSampleViewer]', err);
      setError(t('flipbookError'));
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setDialogOpen(true);
    if (!pages) void load();
  }

  if (!pages && !loading && !error) {
    return (
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
    );
  }

  if (loading && !pages) {
    return (
      <p role="status" className="py-16 text-center text-small text-muted">
        …
      </p>
    );
  }

  if (error && !pages) {
    return (
      <div className="py-10 text-center">
        <p className="text-small text-burgundy">{error}</p>
        <button type="button" onClick={() => void load()} className="btn btn-quiet mt-4">
          {t('pdfRetry')}
        </button>
      </div>
    );
  }

  if (!pages) return null;

  return (
    <div>
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-cream-2/60">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={pageIndex}
            src={pages[pageIndex].dataUrl}
            alt=""
            className="max-h-72 w-auto object-contain shadow-[var(--shadow-soft)]"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
          />
        </AnimatePresence>
      </div>

      <p className="mt-3 text-center text-caption text-muted">{t('pdfSampleNotice')}</p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          disabled={pageIndex <= 0}
          aria-label={t('pdfPrev')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule bg-cream text-ink-soft transition-colors hover:border-gold-deep disabled:opacity-40"
        >
          ‹
        </button>

        <span className="shrink-0 text-caption text-muted">
          {t('pdfPage', { current: pageIndex + 1, total: pages.length })}
        </span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-cream-3">
          <span
            className="block h-full rounded-full bg-gold-deep transition-[width] duration-300"
            style={{ width: `${((pageIndex + 1) / pages.length) * 100}%` }}
          />
        </span>

        <button
          type="button"
          onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
          disabled={pageIndex >= pages.length - 1}
          aria-label={t('pdfNext')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule bg-cream text-ink-soft transition-colors hover:border-gold-deep disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className="btn btn-quiet mt-4 w-full justify-center"
      >
        {t('pdfOpenFullscreen')}
      </button>

      {dialogOpen ? (
        <SampleDialog
          pages={pages}
          pageIndex={pageIndex}
          onPageChange={setPageIndex}
          title={title}
          rtl={isRtl(locale)}
          onClose={() => {
            setDialogOpen(false);
            triggerRef.current?.focus();
          }}
          t={t}
        />
      ) : null}
    </div>
  );
}

/**
 * ה"מסך מלא" האמיתי: Dialog נגיש, לא Fullscreen API על אותו רכיב.
 * Focus Trap ידני (בלי תלות נוספת), Escape סוגר, ופוקוס חוזר לכפתור
 * שפתח אותו — הרכיב הקורא (BookSampleViewerImpl) מטפל בהחזרת הפוקוס.
 */
function SampleDialog({
  pages,
  pageIndex,
  onPageChange,
  title,
  rtl,
  onClose,
  t,
}: {
  pages: RenderedPage[];
  pageIndex: number;
  onPageChange: (index: number) => void;
  title: string;
  rtl: boolean;
  onClose: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose is stable enough for this dialog's lifetime
  }, []);

  const zoom = ZOOM_STEPS[zoomIndex];
  // מצב "התאמה לרוחב" הוא מצב הקריאה הכפול (שני עמודים, כמו ספר פתוח);
  // זום ידני עובר לעמוד בודד מוגדל, כדי שלא יידרש גלילה אופקית מוגזמת.
  const showSpread = fitWidth && pageIndex + 1 < pages.length;

  function submitPageInput(event: React.FormEvent) {
    event.preventDefault();
    const value = Number.parseInt(pageInputRef.current?.value ?? '', 10);
    if (Number.isFinite(value) && value >= 1 && value <= pages.length) {
      onPageChange(value - 1);
    } else if (pageInputRef.current) {
      pageInputRef.current.value = String(pageIndex + 1);
    }
  }

  const spreadPair = showSpread ? [pages[pageIndex], pages[pageIndex + 1]] : [pages[pageIndex]];
  const orderedPair = rtl ? [...spreadPair].reverse() : spreadPair;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4"
    >
      <h2 id={headingId} className="sr-only">
        {t('pdfDialogTitle', { title })}
      </h2>

      <div className="flex h-[min(92vh,1000px)] w-[min(96vw,1500px)] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-cream shadow-[var(--shadow-float)]">
        <div className="flex flex-wrap items-center gap-2 border-b border-rule px-4 py-3">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex <= 0}
            aria-label={t('pdfPrev')}
            className="rounded-full border border-rule px-3 py-1.5 text-small disabled:opacity-40"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(pages.length - 1, pageIndex + 1))}
            disabled={pageIndex >= pages.length - 1}
            aria-label={t('pdfNext')}
            className="rounded-full border border-rule px-3 py-1.5 text-small disabled:opacity-40"
          >
            ›
          </button>

          <form onSubmit={submitPageInput} className="flex items-center gap-1.5">
            <label htmlFor={`${headingId}-page`} className="sr-only">
              {t('pdfPageInputLabel')}
            </label>
            <input
              key={pageIndex}
              ref={pageInputRef}
              id={`${headingId}-page`}
              type="number"
              min={1}
              max={pages.length}
              defaultValue={pageIndex + 1}
              className="field-input w-16 px-2 py-1 text-center"
            />
            <span className="text-caption text-muted">/ {pages.length}</span>
          </form>

          <span className="mx-2 h-5 w-px bg-rule" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            disabled={zoomIndex <= 0}
            aria-label={t('pdfZoomOut')}
            className="rounded-full border border-rule px-3 py-1.5 text-small disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            disabled={zoomIndex >= ZOOM_STEPS.length - 1}
            aria-label={t('pdfZoomIn')}
            className="rounded-full border border-rule px-3 py-1.5 text-small disabled:opacity-40"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setFitWidth(true);
              setZoomIndex(1);
            }}
            aria-pressed={fitWidth}
            className="rounded-[var(--radius-sm)] border border-rule px-3 py-1.5 text-caption"
          >
            {t('pdfFitWidth')}
          </button>

          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label={t('pdfClose')}
            className="ms-auto rounded-full border border-rule px-3 py-1.5 text-small hover:border-gold-deep"
          >
            {t('pdfClose')}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-cream-2/50 p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pageIndex}
              className="flex gap-3"
              dir="ltr"
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.25 }}
            >
              {orderedPair.map((page, index) => (
                // eslint-disable-next-line @next/next/no-img-element -- data URL מקומי שכבר בזיכרון, לא נכס שמתאים לאופטימיזציה של next/image
                <img
                  key={index}
                  src={page.dataUrl}
                  alt=""
                  style={fitWidth ? { maxWidth: '100%', height: 'auto' } : { width: page.width * zoom, height: 'auto' }}
                  className="shadow-[var(--shadow-soft)]"
                />
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
