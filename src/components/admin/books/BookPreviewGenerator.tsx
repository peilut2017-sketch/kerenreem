'use client';

import { useState, useTransition } from 'react';
import { uploadToBucket } from '../ImageField';
import { Spinner } from '../SubmitButton';
import { saveBookPreviewPages } from '@/lib/admin/actions';
import { MAX_PREVIEW_PAGES } from '@/lib/books/render-preview-pages';
import type { BookPreviewPage } from '@/lib/supabase/types';

type Stage = 'idle' | 'scanning' | 'choosing' | 'rendering' | 'saving' | 'done' | 'error';

interface Thumbnail {
  pageNumber: number;
  dataUrl: string;
}

/**
 * הפקת דפי הדוגמה — הצעד היחיד בזרימה שממיר PDF, והוא קורה כאן בניהול
 * ולא בעמוד הציבורי.
 *
 * למה בדפדפן ולא בשרת: ההמרה משתמשת ב-canvas, וההתקנה הקיימת אינה
 * כוללת סביבת רינדור PDF בצד שרת. ההמרה רצה פעם אחת בחיי הספר, על
 * מכונה של עורך, ולכן זה המקום הזול ביותר לעשות אותה.
 *
 * סדר הפעולות בעת יצירה מחדש נבחר כך שלא יהיה רגע שבו לספר אין דוגמה:
 * קודם מעלים את כל הדפים החדשים ל-Storage, ורק כשכולם עלו בהצלחה
 * כותבים למסד (saveBookPreviewPages, שגם מוחק שם רק את מה שאינו ברשימה
 * החדשה). כשל באמצע ההמרה או ההעלאה משאיר את הדוגמה הקודמת שלמה.
 */
export function BookPreviewGenerator({
  bookId,
  pdfUrl,
  existingPages,
}: {
  bookId: string;
  pdfUrl: string | null;
  existingPages: BookPreviewPage[];
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!pdfUrl) {
    return (
      <p className="text-small text-muted">
        כדי ליצור דפי דוגמה יש להעלות תחילה קובץ PDF בשדה &quot;דפדוף לדוגמה&quot; ולשמור את הספר.
      </p>
    );
  }

  async function scan() {
    setStage('scanning');
    setError(null);
    try {
      const { readPdfOutline } = await import('@/lib/books/render-preview-pages');
      const outline = await readPdfOutline(pdfUrl!);
      setThumbnails(outline.thumbnails);
      // ברירת מחדל: הדפים הראשונים עד התקרה — הבחירה הנפוצה, וניתנת לשינוי
      setSelected(
        new Set(outline.thumbnails.slice(0, MAX_PREVIEW_PAGES).map((page) => page.pageNumber)),
      );
      setStage('choosing');
    } catch (err) {
      console.error('[BookPreviewGenerator:scan]', err);
      setError(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }

  function toggle(pageNumber: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else if (next.size < MAX_PREVIEW_PAGES) next.add(pageNumber);
      return next;
    });
  }

  async function generate() {
    setStage('rendering');
    setError(null);
    setProgress({ done: 0, total: selected.size });

    try {
      const { renderPdfPages } = await import('@/lib/books/render-preview-pages');
      const rendered = await renderPdfPages(pdfUrl!, [...selected], (done, total) =>
        setProgress({ done, total }),
      );

      // כל ההעלאות מסתיימות לפני שנוגעים במסד — ראו ההסבר בראש הקובץ
      const uploaded: { page_number: number; image_url: string; width: number; height: number }[] = [];
      for (const page of rendered) {
        const url = await uploadToBucket('samples', page.file, `previews/${bookId}`);
        uploaded.push({
          page_number: page.pageNumber,
          image_url: url,
          width: page.width,
          height: page.height,
        });
      }

      setStage('saving');
      startTransition(async () => {
        const result = await saveBookPreviewPages(bookId, uploaded);
        if (result?.error) {
          setError(result.error);
          setStage('error');
        } else {
          setStage('done');
        }
      });
    } catch (err) {
      console.error('[BookPreviewGenerator:generate]', err);
      setError(err instanceof Error ? err.message : String(err));
      setStage('error');
    }
  }

  return (
    <div>
      {existingPages.length > 0 && stage === 'idle' ? (
        <div className="mb-5">
          <p className="text-small text-ink-soft">
            קיימים {existingPages.length} דפי דוגמה. יצירה מחדש תחליף אותם.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {existingPages.slice(0, 12).map((page) => (
              <li key={page.id} className="w-16">
                {/* eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה בניהול, לא נכס ציבורי */}
                <img
                  src={page.image_url}
                  alt={`עמוד ${page.page_number}`}
                  className="w-full border border-rule object-contain"
                />
                <span className="block text-center text-caption text-muted">{page.page_number}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {stage === 'idle' || stage === 'error' || stage === 'done' ? (
        <button type="button" onClick={() => void scan()} className="btn btn-solid">
          {existingPages.length > 0 ? 'יצירת דפי דוגמה מחדש' : 'צור דפי דוגמה'}
        </button>
      ) : null}

      {stage === 'scanning' ? (
        <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
          <Spinner className="h-4 w-4" /> קורא את קובץ ה-PDF…
        </p>
      ) : null}

      {stage === 'choosing' ? (
        <div>
          <p className="text-small text-ink-soft">
            סמנו אילו עמודים מותרים לפרסום. נבחרו {selected.size} מתוך {MAX_PREVIEW_PAGES} המרביים.
          </p>

          <ul className="mt-4 grid max-h-96 grid-cols-3 gap-3 overflow-y-auto border border-rule p-3 sm:grid-cols-5 lg:grid-cols-8">
            {thumbnails.map((thumbnail) => {
              const isSelected = selected.has(thumbnail.pageNumber);
              return (
                <li key={thumbnail.pageNumber}>
                  <label className="block cursor-pointer text-center">
                    <span className="sr-only">עמוד {thumbnail.pageNumber}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(thumbnail.pageNumber)}
                      className="sr-only"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element -- data URL זמני שנוצר בדפדפן */}
                    <img
                      src={thumbnail.dataUrl}
                      alt=""
                      className={`w-full border-2 object-contain ${
                        isSelected ? 'border-burgundy' : 'border-rule opacity-60'
                      }`}
                    />
                    <span className="text-caption text-muted">{thumbnail.pageNumber}</span>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void generate()}
              disabled={selected.size === 0}
              className="btn btn-solid"
            >
              המר {selected.size} עמודים והעלה
            </button>
            <button type="button" onClick={() => setStage('idle')} className="btn btn-quiet">
              ביטול
            </button>
          </div>
        </div>
      ) : null}

      {stage === 'rendering' ? (
        <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
          <Spinner className="h-4 w-4" /> ממיר עמודים ומעלה… {progress.done}/{progress.total}
        </p>
      ) : null}

      {stage === 'saving' || pending ? (
        <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
          <Spinner className="h-4 w-4" /> שומר…
        </p>
      ) : null}

      {stage === 'done' ? (
        <p className="mt-3 text-small text-ink-soft">
          דפי הדוגמה נשמרו. רעננו את העמוד כדי לראות את התצוגה המעודכנת.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-small text-burgundy">
          {error}
        </p>
      ) : null}
    </div>
  );
}
