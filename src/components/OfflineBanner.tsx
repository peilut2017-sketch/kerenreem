'use client';

import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@/lib/client-hooks';

/**
 * [1.4] "אין שום התייחסות ל-offline — navigator.onLine מופיע 0 פעמים
 * בקוד" (ביקורת המימוש, פער 23). רצועה עליונה קבועה, לא רק בקופה:
 * ניתוק אמיתי (Wi-Fi/מטוס) פוגע בכל פעולה שדורשת שרת בכל עמוד — סל,
 * מועדפים, התחברות — לא רק בתשלום עצמו. role="status" ולא role="alert":
 * זו הודעת מצב מתמשכת, לא אירוע חד-פעמי שדורש הפרעה.
 */
export function OfflineBanner() {
  const t = useTranslations('error');
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] bg-[var(--color-burgundy,#7a2436)] px-4 py-2 text-center text-caption font-semibold text-white"
    >
      {t('offline')}
    </div>
  );
}
