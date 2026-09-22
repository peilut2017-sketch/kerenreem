'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeAdminToast,
  subscribeAdminToastDismiss,
  type AdminToast,
} from '@/lib/admin/toast-bus';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

/** משך הנפשת היציאה — ההודעה נשארת ב-DOM עד שהיא מסתיימת. */
const EXIT_MS = 180;

interface LiveToast extends AdminToast {
  leaving?: boolean;
}

/**
 * [1.40] מארח ההודעות — פינה שמאלית-תחתונה, חלונית קומפקטית עם פס
 * טיימר שמראה כמה זמן נשאר לה.
 *
 * מורכב פעם אחת ב-DashboardLayout, כדי שההודעה תישאר גלויה גם
 * כשהטופס שהפעיל אותה מנווט משם מיד אחרי (סגירת כרטיס / חזרה
 * לרשימה) — ראו toast-bus.ts.
 *
 * הודעה שכבר על המסך יכולה *להתעדכן* ולא רק להצטבר: שמירה ברקע
 * פותחת "שומר…" ומחליפה אותה ל"נשמר" באותו חלון. הזיהוי לפי id,
 * וכל עדכון מאפס את הטיימר (key על פס הטיימר) כדי שהספירה תתחיל
 * מחדש מהמצב החדש ולא תמשיך מזו של ה"שומר…" שאין לה משך בכלל.
 *
 * ריחוף/מיקוד עוצרים את הטיימר: הודעה שנעלמת בדיוק כשקוראים אותה,
 * או בזמן שמנסים ללחוץ על הקישור שבה, היא תקלת שימושיות.
 */
export function ToastHost() {
  const [toasts, setToasts] = useState<LiveToast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      clearTimer(id);
      setToasts((current) => current.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), EXIT_MS);
    },
    [clearTimer],
  );

  const schedule = useCallback(
    (id: string, durationMs: number | null) => {
      clearTimer(id);
      if (durationMs == null) return;
      timers.current.set(
        id,
        setTimeout(() => remove(id), durationMs),
      );
    },
    [clearTimer, remove],
  );

  useEffect(() => {
    const offToast = subscribeAdminToast((toast) => {
      setToasts((current) => {
        const existing = current.findIndex((t) => t.id === toast.id);
        if (existing === -1) return [...current, toast];
        const next = [...current];
        next[existing] = { ...toast };
        return next;
      });
      schedule(toast.id, toast.durationMs);
    });
    const offDismiss = subscribeAdminToastDismiss(remove);
    return () => {
      offToast();
      offDismiss();
    };
  }, [schedule, remove]);

  // ניקוי טיימרים בפירוק — אחרת setTimeout ממשיך לרוץ על רכיב שאינו קיים
  const timersRef = timers;
  useEffect(() => {
    const map = timersRef.current;
    return () => {
      for (const timer of map.values()) clearTimeout(timer);
      map.clear();
    };
  }, [timersRef]);

  if (toasts.length === 0) return null;

  return (
    <div className="admin-toast-host">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          onMouseEnter={() => clearTimer(toast.id)}
          onFocusCapture={() => clearTimer(toast.id)}
          onMouseLeave={() => schedule(toast.id, toast.durationMs)}
          className={`admin-toast admin-toast-${toast.tone} ${toast.leaving ? 'admin-toast-leaving' : ''}`}
        >
          <span className="admin-toast-icon" aria-hidden="true">
            {toast.tone === 'pending' ? (
              <Spinner className="h-3.5 w-3.5" />
            ) : (
              <AdminIcon name={toast.tone === 'success' ? 'check' : 'warning'} className="h-3.5 w-3.5" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-small font-semibold leading-snug text-ink">{toast.message}</span>
            {toast.detail ? (
              <span className="mt-0.5 block truncate text-caption text-muted" title={toast.detail}>
                {toast.detail}
              </span>
            ) : null}
            {toast.action ? (
              <Link
                href={toast.action.href}
                className="mt-1.5 inline-block text-caption font-semibold text-[var(--admin-accent)] underline underline-offset-4"
              >
                {toast.action.label}
              </Link>
            ) : null}
          </span>

          <button
            type="button"
            onClick={() => remove(toast.id)}
            aria-label="סגירת ההודעה"
            className="shrink-0 rounded-[var(--admin-radius-btn)] p-1 text-muted transition-colors hover:text-burgundy"
          >
            <AdminIcon name="x" className="h-3.5 w-3.5" />
          </button>

          {toast.tone === 'pending' ? (
            <span className="admin-toast-progress" aria-hidden="true" />
          ) : toast.durationMs != null ? (
            /* key מבוסס-משך: עדכון ההודעה מתחיל ספירה חדשה במקום
               להמשיך אנימציה שכבר רצה מהמצב הקודם. */
            <span
              key={`${toast.tone}-${toast.durationMs}`}
              aria-hidden="true"
              className="admin-toast-timer"
              style={{ animationDuration: `${toast.durationMs}ms` }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
