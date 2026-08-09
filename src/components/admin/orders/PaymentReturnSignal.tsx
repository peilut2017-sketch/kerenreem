'use client';

import { useEffect } from 'react';

/**
 * [1.5] רץ בתוך ה-iframe אחרי שמורנינג הפנתה חזרה לכתובת שלנו (הצלחה/כשל).
 * בשלב הזה ה-iframe כבר same-origin עם ההורה (זו כתובת שלנו), ולכן
 * postMessage עם origin מדויק — לא '*'. אין כאן שום עדכון למצב ההזמנה;
 * זה תפקידו הבלעדי של ה-Webhook (ראו ההערה ב-startPayment).
 */
export function PaymentReturnSignal({ outcome }: { outcome: 'success' | 'failure' }) {
  useEffect(() => {
    window.parent?.postMessage({ type: 'kr-admin-payment-return', outcome }, window.location.origin);
  }, [outcome]);

  return null;
}
