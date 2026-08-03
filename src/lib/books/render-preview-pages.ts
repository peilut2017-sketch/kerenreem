/**
 * המרת דפי PDF לתמונות WebP — רץ בדפדפן, בממשק הניהול בלבד.
 *
 * זו הנקודה שבה ההמרה קורית *פעם אחת*, בזמן עריכת הספר, ולא בכל טעינה
 * של העמוד הציבורי: המבקר מקבל קובצי WebP מוכנים מ-Storage, ו-pdf.js
 * (ספרייה כבדה) לא נטענת אצלו בכלל. ראו BookPreviewGenerator.
 *
 * הקובץ אינו 'use client' בעצמו — הוא מודול עזר שנטען דינמית מתוך רכיב
 * לקוח, וכל התלות ב-pdfjs היא ב-import דינמי בגוף הפונקציה.
 */

/** דפים רבים מדי כבר אינם "דוגמה" — וגם זכויות הפרסום לרוב אינן מתירות זאת. */
export const MAX_PREVIEW_PAGES = 40;
/** רוחב יעד לדף מומר. גבוה מספיק לקריאה בזום, נמוך מספיק לטעינה מהירה. */
const TARGET_WIDTH = 1400;
const WEBP_QUALITY = 0.88;

export interface RenderedPreviewPage {
  pageNumber: number;
  file: File;
  width: number;
  height: number;
}

/** מידע מינימלי על ה-PDF, לבחירת הדפים לפני ההמרה עצמה. */
export interface PdfOutline {
  pageCount: number;
  /** תמונות תצוגה מוקטנות, אחת לכל דף, לבחירה ויזואלית. */
  thumbnails: { pageNumber: number; dataUrl: string }[];
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

/**
 * סריקה ראשונית: כמה דפים יש, ותצוגה מוקטנת של כל אחד כדי שהעורך יוכל
 * לבחור מה מותר לפרסם. הרזולוציה כאן נמוכה בכוונה — אלה תמונות בחירה
 * שנזרקות אחרי הבחירה, לא הנכס הסופי.
 */
export async function readPdfOutline(pdfUrl: string, thumbnailWidth = 220): Promise<PdfOutline> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument(pdfUrl).promise;

  const thumbnails: { pageNumber: number; dataUrl: string }[] = [];
  const scanned = Math.min(doc.numPages, 120);

  for (let pageNumber = 1; pageNumber <= scanned; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: thumbnailWidth / base.width });

    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) continue;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    thumbnails.push({ pageNumber, dataUrl: canvas.toDataURL('image/jpeg', 0.6) });
  }

  return { pageCount: doc.numPages, thumbnails };
}

/**
 * ההמרה עצמה — רק לדפים שהעורך אישר.
 *
 * שם המשתנה הוא `doc` ולא `document`: הצללה של ה-`document` הגלובלי כאן
 * הייתה שוברת את `document.createElement` שורה אחרי, וזה מסוג הבאגים
 * שנראים תקינים לגמרי בקריאה.
 */
export async function renderPdfPages(
  pdfUrl: string,
  allowedPageNumbers: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedPreviewPage[]> {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument(pdfUrl).promise;

  const wanted = [...new Set(allowedPageNumbers)]
    .filter((pageNumber) => pageNumber >= 1 && pageNumber <= doc.numPages)
    .sort((a, b) => a - b)
    .slice(0, MAX_PREVIEW_PAGES);

  const results: RenderedPreviewPage[] = [];

  for (const pageNumber of wanted) {
    const page = await doc.getPage(pageNumber);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });

    const canvas = window.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    // alpha:false — דף ספר אינו שקוף, וקנבס אטום מהיר יותר לרינדור
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error(`אין הקשר קנבס לעמוד ${pageNumber}`);

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error(`המרת עמוד ${pageNumber} נכשלה`))),
        'image/webp',
        WEBP_QUALITY,
      );
    });

    results.push({
      pageNumber,
      width: canvas.width,
      height: canvas.height,
      file: new File([blob], `page-${String(pageNumber).padStart(3, '0')}.webp`, {
        type: 'image/webp',
      }),
    });

    onProgress?.(results.length, wanted.length);
  }

  return results;
}
