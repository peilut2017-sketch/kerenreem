'use client';

import { useEffect } from 'react';
import { gaEvent } from '@/lib/analytics/client';

/**
 * אירוע view_item ל-GA4 בטעינת עמוד ספר — כדי שדוחות ה-ecommerce של גוגל
 * יידעו איזה ספר נצפה. הצפייה באנליטיקה העצמאית נספרת כבר לפי הנתיב
 * (/books/<slug>, ראו AnalyticsBeacon) ואינה צריכה אירוע נפרד. בלי GA
 * טעון (אין הסכמה/אין מזהה) הקריאה היא no-op.
 */
export function BookViewTracker({ bookId, title }: { bookId: string; title: string }) {
  useEffect(() => {
    gaEvent('view_item', { items: [{ item_id: bookId, item_name: title }] });
  }, [bookId, title]);
  return null;
}
