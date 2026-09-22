'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  getIncidentTimeline,
  setIncidentStatus,
  type IncidentTimelineEntry,
} from '@/lib/admin/monitoring-actions';
import type { MonitoringIncident } from '@/lib/admin/monitoring-queries';
import { formatAdminDate } from '@/lib/admin/reporting/format';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

/**
 * [1.40] לוח האירועים — "מה קרה", להבדיל מ"מה המצב עכשיו" שמוצג מעליו.
 *
 * אירוע נפתח ונסגר אוטומטית על ידי מערכת ההתראות (ראו
 * /api/monitoring/incident), וכל תסמין נוסף מצטרף לאותו אירוע במקום
 * לפתוח חדש. המסך הזה מציג את התוצאה: מה נפל, מה הייתה ההשפעה, מתי,
 * וכמה זמן זה נמשך — ומאפשר לסמן "בטיפול" או לסגור ידנית.
 *
 * ציר הזמן נטען לפי דרישה, בפתיחת השורה: לאירוע יכולים להיות עשרות
 * תסמינים, ואין סיבה למשוך את כולם לכל אירוע בכל טעינת מסך.
 */
export function MonitoringBoard({ incidents }: { incidents: MonitoringIncident[] }) {
  const [showResolved, setShowResolved] = useState(false);

  const open = incidents.filter((incident) => incident.status !== 'resolved');
  const resolved = incidents.filter((incident) => incident.status === 'resolved');
  const shown = showResolved ? incidents : open;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-serif text-h3 text-ink">אירועים</h2>
        {open.length > 0 ? (
          <span className="admin-badge admin-badge-danger">
            <span className="admin-badge-dot" aria-hidden="true" />
            {open.length} פתוחים
          </span>
        ) : (
          <span className="admin-badge admin-badge-success">
            <span className="admin-badge-dot" aria-hidden="true" />
            אין אירועים פתוחים
          </span>
        )}
        {resolved.length > 0 ? (
          <label className="ms-auto inline-flex cursor-pointer items-center gap-2 text-small text-ink-soft">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
              className="h-4 w-4 accent-[var(--admin-accent)]"
            />
            הצגת {resolved.length} אירועים סגורים
          </label>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <p className="admin-card px-4 py-6 text-center text-small text-muted">
          {incidents.length === 0
            ? 'טרם נרשמו אירועים. כשמערכת ההתראות תזהה תקלה, היא תופיע כאן עם ציר הזמן המלא שלה.'
            : 'אין אירועים פתוחים.'}
        </p>
      ) : (
        <ol className="space-y-3">
          {shown.map((incident) => (
            <IncidentRow key={incident.id} incident={incident} />
          ))}
        </ol>
      )}
    </section>
  );
}

const SCOPE_LABELS: Record<string, string> = {
  server: 'שרת',
  docker: 'קונטיינרים',
  postgres: 'מסד נתונים',
  supabase: 'Supabase',
  app: 'אפליקציה',
  network: 'רשת',
  vercel: 'פריסה',
};

/** משך האירוע בשפה אנושית — "שעתיים ו-12 דקות" ולא 7920 שניות. */
function duration(from: string, to: string | null): string {
  const ms = new Date(to ?? Date.now()).getTime() - new Date(from).getTime();
  if (ms < 0) return '—';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'פחות מדקה';
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `${hours} ש׳ ו-${rest} דק׳` : `${hours} ש׳`;
  return `${Math.floor(hours / 24)} ימים ו-${hours % 24} ש׳`;
}

function IncidentRow({ incident }: { incident: MonitoringIncident }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [timeline, setTimeline] = useState<IncidentTimelineEntry[] | null>(null);
  const [loading, startLoad] = useTransition();
  const [acting, startAct] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isOpen = incident.status !== 'resolved';
  const critical = incident.severity === 'critical';

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && timeline === null) {
      startLoad(async () => {
        const result = await getIncidentTimeline(incident.id);
        if (result.error) setError(result.error);
        setTimeline(result.entries);
      });
    }
  }

  function act(status: 'acknowledged' | 'resolved') {
    startAct(async () => {
      setError(null);
      const result = await setIncidentStatus(incident.id, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  const runbook = typeof incident.context.runbook === 'string' ? incident.context.runbook : null;
  const instance = typeof incident.context.instance === 'string' ? incident.context.instance : null;

  return (
    <li
      className={`admin-card overflow-hidden ${
        isOpen && critical ? 'border-s-4 border-s-[var(--admin-danger)]' : ''
      } ${isOpen && !critical ? 'border-s-4 border-s-[var(--admin-warning)]' : ''}`}
    >
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={`admin-badge ${critical ? 'admin-badge-danger' : 'admin-badge-neutral'}`}
          >
            <AdminIcon name="warning" className="h-3.5 w-3.5" />
            {critical ? 'קריטי' : 'אזהרה'}
          </span>
          <span className="admin-badge admin-badge-neutral">
            {SCOPE_LABELS[incident.scope] ?? incident.scope} · {incident.component}
          </span>
          {incident.status === 'acknowledged' ? (
            <span className="admin-badge admin-badge-accent">בטיפול</span>
          ) : null}
          {!isOpen ? <span className="admin-badge admin-badge-success">נסגר</span> : null}

          <span className="ms-auto text-caption text-muted tabular-nums">
            {formatAdminDate(incident.startedAt, 'dateTime')} · {duration(incident.startedAt, incident.resolvedAt)}
          </span>
        </div>

        <h3 className="mt-2.5 text-body font-semibold text-ink">{incident.title}</h3>
        {incident.impact ? (
          <p className="mt-1 text-small text-ink-soft">
            <span className="text-muted">השפעה: </span>
            {incident.impact}
          </p>
        ) : null}
        {instance ? (
          <p dir="ltr" className="mt-1 text-start text-caption text-muted">
            {instance}
          </p>
        ) : null}
        {incident.resolution ? (
          <p className="mt-1 text-caption text-muted">נסגר: {incident.resolution}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggle} className="admin-btn admin-btn-ghost">
            <AdminIcon name="list" className="h-4 w-4" />
            {expanded ? 'הסתרת ציר הזמן' : `ציר זמן (${incident.eventCount})`}
          </button>

          {runbook ? (
            // מדריך הטיפול צמוד לאירוע: התראה בלי מדריך היא בעיה
            // שמישהו יפתור מאפס בשתיים בלילה.
            <span className="inline-flex items-center gap-1.5 text-caption text-muted">
              <AdminIcon name="pages" className="h-3.5 w-3.5" />
              מדריך טיפול: <code dir="ltr">{runbook}</code>
            </span>
          ) : null}

          {isOpen ? (
            <span className="ms-auto flex items-center gap-2">
              {incident.status === 'open' ? (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() => act('acknowledged')}
                  className="admin-btn admin-btn-quiet"
                >
                  {acting ? <Spinner className="h-3.5 w-3.5" /> : null}
                  סימון כבטיפול
                </button>
              ) : null}
              <button
                type="button"
                disabled={acting}
                onClick={() => act('resolved')}
                className="admin-btn admin-btn-solid"
              >
                {acting ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
                סגירה
              </button>
            </span>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-small text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
      </div>

      {expanded ? (
        <div className="border-t border-rule bg-cream-2/40 px-4 py-3">
          {loading && timeline === null ? (
            <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
              <Spinner className="h-3.5 w-3.5" /> טוען…
            </p>
          ) : timeline && timeline.length > 0 ? (
            <ol className="space-y-2">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3 text-small">
                  <time
                    dateTime={entry.at}
                    className="shrink-0 text-caption text-muted tabular-nums"
                  >
                    {formatAdminDate(entry.at, 'dateTime')}
                  </time>
                  <span className="text-ink-soft">{entry.message}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-small text-muted">אין רשומות בציר הזמן.</p>
          )}
        </div>
      ) : null}
    </li>
  );
}
