'use client';

import dynamic from 'next/dynamic';

/**
 * שער הכניסה לדפדוף.
 *
 * הרכיב הזה הוא גבול לקוח דק בכוונה: הוא אינו מכיל לוגיקה, רק את
 * הטעינה הדינמית. ssr:false אינו בחירת ביצועים אלא הכרח — StPageFlip
 * נוגעת ב-document ומודדת אלמנטים באתחול, ולכן אינה יכולה לרוץ ברינדור
 * שרת. ב-Next 16 אי אפשר להצהיר על ssr:false בתוך Server Component,
 * ולכן ההצהרה יושבת כאן ולא בעמוד עצמו.
 *
 * הפיצול לשני קבצים נשמר גם אחרי המעבר לגבול לקוח: כל המשקל האמיתי
 * (react-pageflip) יושב ב-BookFlipViewerClient ונטען רק כשיש דפי דוגמה
 * להציג. ספר בלי דוגמה — המצב הנפוץ בקטלוג שנבנה בהדרגה — אינו משלם
 * עליו כלל.
 *
 * ה-skeleton תופס את אותו מקום שהדפדוף יתפוס, כדי שהעמוד לא יקפוץ.
 */
export const BookFlipViewer = dynamic(
  () => import('./BookFlipViewerClient').then((module) => module.BookFlipViewerClient),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-16/10 animate-pulse rounded-[2rem] bg-cream-3" aria-hidden="true" />
    ),
  },
);
