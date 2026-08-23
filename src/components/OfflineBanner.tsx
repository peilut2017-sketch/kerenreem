'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/lib/client-hooks';

/**
 * [1.4] "אין שום התייחסות ל-offline — navigator.onLine מופיע 0 פעמים
 * בקוד" (ביקורת המימוש, פער 23). רצועה עליונה קבועה, לא רק בקופה:
 * ניתוק אמיתי (Wi-Fi/מטוס) פוגע בכל פעולה שדורשת שרת בכל עמוד — סל,
 * מועדפים, התחברות — לא רק בתשלום עצמו. role="status" ולא role="alert":
 * זו הודעת מצב מתמשכת, לא אירוע חד-פעמי שדורש הפרעה.
 *
 * גובה הרצועה נכתב כמשתנה גלובלי (--offline-h): גם הרצועה וגם כותרת
 * האתר הן sticky top-0, ובלי התיאום הזה הרצועה — שה-z שלה גבוה יותר —
 * פשוט כיסתה את הלוגו בזמן גלילה. הכותרת נצמדת מתחת לרצועה
 * (top-[var(--offline-h)]) במקום להתחרות איתה על אותה שורה.
 */
export function OfflineBanner() {
  const t = useTranslations('error');
  const online = useOnlineStatus();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (online) return;
    const node = ref.current;
    if (!node) return;

    const root = document.documentElement;
    const update = () => root.style.setProperty('--offline-h', `${node.offsetHeight}px`);
    update();
    // ResizeObserver ולא מדידה חד-פעמית: הטקסט נשבר לשתי שורות במסך צר
    // או בהגדלת גופן מסרגל הנגישות, והגובה משתנה איתו.
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--offline-h');
    };
  }, [online]);

  if (online) return null;

  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] bg-[var(--color-burgundy,#7a2436)] px-4 py-2 text-center text-caption font-semibold text-white"
    >
      {t('offline')}
    </div>
  );
}
