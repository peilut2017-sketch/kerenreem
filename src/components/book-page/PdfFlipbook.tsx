'use client';

import { useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Drawer } from '../Drawer';

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
 * דפדוף חי בדוגמה מתוך הספר — לא קישור ל-PDF שנפתח בכרטיסייה חדשה.
 *
 * הרינדור של pdf.js קורה רק כשהמשתמש פותח את הדפדוף, לא בטעינת העמוד:
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
  const [open, setOpen] = useState(false);
  const [pages, setPages] = useState<RenderedPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedFor = useRef<string | null>(null);
  const titleId = useId();

  async function openReader() {
    setOpen(true);
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
        const page = await doc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.4 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) continue;

        await page.render({ canvasContext: context, viewport }).promise;
        rendered.push({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: viewport.width, height: viewport.height });
      }

      loadedFor.current = pdfUrl;
      setPages(rendered);
    } catch (err) {
      console.error('[PdfFlipbook]', err);
      setError('טעינת הדפדוף נכשלה. אפשר לפתוח את הקובץ ישירות.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void openReader()} className="btn btn-quiet">
        {t('readSample')}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        title={title}
        widthClassName="max-w-[min(96vw,64rem)]"
        footer={<p className="text-caption text-muted">{t('flipbookHint')}</p>}
      >
        {loading ? (
          <p className="py-16 text-center text-small text-muted">…</p>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-small text-burgundy">{error}</p>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="link mt-3 inline-block text-small">
              {pdfUrl}
            </a>
          </div>
        ) : pages && pages.length > 0 ? (
          <div className="mx-auto flex justify-center">
            {/* @ts-expect-error -- react-pageflip's public types don't model children/style precisely */}
            <HTMLFlipBook
              width={pages[0].width}
              height={pages[0].height}
              size="stretch"
              minWidth={220}
              maxWidth={720}
              minHeight={300}
              maxHeight={960}
              showCover
              className="shadow-[var(--shadow-float)]"
            >
              {pages.map((page, index) => (
                <div key={index} className="bg-cream">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL מקומי שכבר בזיכרון, לא נכס שמתאים לאופטימיזציה של next/image */}
                  <img src={page.dataUrl} alt="" className="h-full w-full object-contain" />
                </div>
              ))}
            </HTMLFlipBook>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
