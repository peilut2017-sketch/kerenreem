'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PreviewPage } from './BookFlipPage';

/**
 * קריאה מוגדלת של דף הדוגמה.
 *
 * Dialog אמיתי ולא Fullscreen API על רכיב הדפדוף: הדפדוף חי על מופע
 * StPageFlip עם גאומטריה משלו, והגדלה שלו במקום הייתה מחייבת אתחול
 * מחדש ואיבוד המיקום. כאן מוצג עמוד בודד גדול — זו תצוגת *קריאה*, לא
 * תצוגת דפדוף, ולכן היא גם פשוטה יותר לניווט במקלדת.
 *
 * מקבל את הדפים בסדר הטבעי (עמוד 1 ראשון) ומנווט לפי מיקום קריאה, בלי
 * ההיפוך שהדפדוף עצמו צריך — כאן אין spread ואין כיוון כריכה.
 */
export function BookFlipDialog({
  pages,
  startAt,
  title,
  rtl,
  pdfUrl,
  onClose,
}: {
  pages: PreviewPage[];
  startAt: number;
  title: string;
  rtl: boolean;
  pdfUrl: string | null;
  onClose: () => void;
}) {
  const t = useTranslations('books');
  const [index, setIndex] = useState(() => Math.min(Math.max(startAt, 0), pages.length - 1));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const goNext = useCallback(() => setIndex((i) => Math.min(pages.length - 1, i + 1)), [pages.length]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight';
        if (forward) goNext();
        else goPrev();
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
  }, [onClose, rtl, goNext, goPrev]);

  const page = pages[index];

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-4"
    >
      <h2 id={headingId} className="sr-only">
        {t('pdfDialogTitle', { title })}
      </h2>

      <div className="flex h-[min(92vh,1000px)] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-cream shadow-[var(--shadow-float)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-3">
          <button type="button" onClick={goPrev} disabled={index <= 0} className="btn btn-quiet">
            {t('pdfPrev')}
          </button>

          <span aria-live="polite" className="text-caption text-muted">
            {t('pdfPage', { current: index + 1, total: pages.length })}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={index >= pages.length - 1}
            className="btn btn-quiet"
          >
            {t('pdfNext')}
          </button>

          {pdfUrl ? (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn btn-quiet">
              {t('flipOpenPdf')}
            </a>
          ) : null}

          <button ref={closeRef} type="button" onClick={onClose} className="btn btn-quiet ms-auto">
            {t('pdfClose')}
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-cream-2/50 p-4 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- נכס WebP מוכן; ראו BookFlipPage */}
          <img
            src={page.imageUrl}
            alt={t('flipPageAlt', { page: page.pageNumber, title })}
            className="max-h-full w-auto max-w-full object-contain shadow-[var(--shadow-soft)]"
          />
        </div>
      </div>
    </div>
  );
}
