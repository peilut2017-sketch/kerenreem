'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { PreviewPage } from './BookFlipPage';

/**
 * הפיצול לשני קבצים נשמר גם אחרי המעבר לגבול לקוח: כל המשקל האמיתי
 * (react-pageflip) יושב ב-BookFlipViewerClient ונטען רק כשיש דפי דוגמה
 * להציג. ספר בלי דוגמה — המצב הנפוץ בקטלוג שנבנה בהדרגה — אינו משלם
 * עליו כלל. ssr:false אינו בחירת ביצועים אלא הכרח — StPageFlip נוגעת
 * ב-document ומודדת אלמנטים באתחול, ולכן אינה יכולה לרוץ ברינדור שרת.
 *
 * loading: () => null בכוונה: התצוגה בזמן הטעינה אינה גוש אפור פועם,
 * אלא תמונת העמוד הראשון עצמה — ראו BookFlipViewer למטה.
 */
const Interactive = dynamic(
  () => import('./BookFlipViewerClient').then((module) => module.BookFlipViewerClient),
  { ssr: false, loading: () => null },
);

/**
 * שער הכניסה לדפדוף.
 *
 * העמוד הראשון מוצג כתמונה סטטית מהרגע הראשון — לא כגוש אפור פועם —
 * כי הוא כבר ידוע בשרת (previewPages[0], ראו page.tsx) ואינו זקוק
 * לספרייה הכבדה כדי להיראות. היא יושבת בזרימה הרגילה וקובעת את גובה
 * האזור (aspect-16/10), בזמן שה-Client component האמיתי נטען מעליה
 * (absolute inset-0) ומדווח (onReady) ברגע שסיים את ה-mount הראשון שלו;
 * או-אז יש Crossfade אל הדפדוף האינטראקטיבי המלא.
 *
 * הסדר הזה בטוח מבחינת StPageFlip, שמודדת את הקונטיינר שלה בזמן ה-mount:
 * באותו רגע התמונה הסטטית עדיין תופסת מקום ונותנת לקונטיינר המשותף
 * גובה אמיתי (opacity אינו משפיע על מדידת גודל, בניגוד ל-display:none
 * או להסתרה מסוג sr-only שהייתה מכווצת את הקונטיינר לפיקסל אחד).
 */
export function BookFlipViewer({
  pages,
  title,
  pdfUrl,
  locale,
}: {
  pages: PreviewPage[];
  title: string;
  pdfUrl: string | null;
  locale: string;
}) {
  const [ready, setReady] = useState(false);
  const first = pages[0];

  return (
    <div className="relative">
      {first ? (
        <div
          aria-hidden="true"
          className={`aspect-16/10 overflow-hidden rounded-[2rem] border border-rule bg-cream-3 transition-opacity duration-500 ${
            ready ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- נכס WebP מוכן, כמו ב-BookFlipPage */}
          <img src={first.imageUrl} alt="" className="h-full w-full object-contain" />
        </div>
      ) : null}

      <div
        className={`absolute inset-0 transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
      >
        <Interactive
          pages={pages}
          title={title}
          pdfUrl={pdfUrl}
          locale={locale}
          onReady={() => setReady(true)}
        />
      </div>
    </div>
  );
}
