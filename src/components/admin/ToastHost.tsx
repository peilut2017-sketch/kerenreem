'use client';

import { useEffect, useState } from 'react';
import { subscribeAdminToast } from '@/lib/admin/toast-bus';

interface ToastItem {
  id: number;
  message: string;
}

/** [1.10] כמה שניות ההודעה נשארת גלויה לפני שהיא נעלמת מעצמה. */
const DISPLAY_MS = 4000;

/**
 * מארח הודעות "נשמר בהצלחה" — מורכב פעם אחת ב-DashboardLayout, כדי
 * שההודעה תישאר גלויה גם כש-EntityForm שהפעיל אותה מנווט משם מיד אחרי
 * (סגירת כרטיס / חזרה לרשימה). ראו toast-bus.ts.
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return subscribeAdminToast((message) => {
      const id = Math.random();
      setToasts((current) => [...current, { id, message }]);
      setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), DISPLAY_MS);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed end-4 top-4 z-[60] flex w-full max-w-[22rem] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="admin-card pointer-events-auto flex items-center gap-3 border-s-2 border-s-[var(--admin-success)] px-4 py-3"
        >
          <span className="admin-badge-dot text-[var(--admin-success)]" aria-hidden="true" />
          <span className="flex-1 text-small text-ink">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            aria-label="סגירת ההודעה"
            className="shrink-0 rounded-[var(--admin-radius-btn)] p-1 text-muted transition-colors hover:text-burgundy"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none">
              <path d="m6 6 8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
