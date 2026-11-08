'use client';

import { useState, useTransition } from 'react';
import {
  checkInboundPing,
  sendInboundPing,
  type InboundDiagnostics as Diagnostics,
} from '@/lib/admin/inbound-diagnostics';
import { formatAdminDate } from '@/lib/admin/reporting/format';
import { Spinner } from './SubmitButton';

/** מה המשמעות של כל תוצאה ביומן, ומה עושים. */
const OUTCOME: Record<string, { label: string; badge: string }> = {
  recorded: { label: 'נקלט ונשמר בשרשור', badge: 'admin-badge-success' },
  ping: { label: 'בדיקת מקצה לקצה הגיעה', badge: 'admin-badge-success' },
  duplicate: { label: 'כפילות — כבר נקלט', badge: '' },
  ignored: { label: 'מענה אוטומטי — לא נקלט', badge: '' },
  rejected: { label: 'נדחה', badge: 'admin-badge-warning' },
  failed: { label: 'נכשל', badge: 'admin-badge-danger' },
  unauthorized: { label: 'סוד שגוי', badge: 'admin-badge-danger' },
};

const REASON: Record<string, string> = {
  'bad reply address':
    'הכתובת שאליה נשלח המייל אינה כתובת פנייה חתומה תקינה — חתימה שגויה, או INBOUND_EMAIL_SECRET שונה מזה ששימש ליצירת ההתראה.',
  'sender is not staff':
    'השולח אינו איש צוות מורשה ואינו הפונה בפנייה. יש לענות מכתובת של משתמש ניהול (עורך ומעלה), מתיבת הפניות שהוגדרה, או — כבדיקת פונה — מכתובת הפונה עצמה.',
  'inquiry not found': 'הפנייה נמחקה או שהמזהה בכתובת אינו קיים.',
  'empty reply': 'לא נשאר טקסט אחרי הסרת הציטוט (התשובה הייתה ציטוט בלבד).',
  'no sender': 'לא נמצאה כתובת שולח בכותרות המייל.',
  'reply too long': 'התשובה ארוכה מ-20,000 תווים.',
};

function explain(row: { outcome: string; reason: string | null }): string {
  if (row.reason && REASON[row.reason]) return REASON[row.reason];
  return row.reason ?? '';
}

type PingState =
  | { phase: 'idle' }
  | { phase: 'waiting' }
  | { phase: 'ok' }
  | { phase: 'timeout'; since: { outcome: string; reason: string | null }[] }
  | { phase: 'error'; message: string };

export function InboundDiagnostics({ initial }: { initial: Diagnostics }) {
  const [ping, setPing] = useState<PingState>({ phase: 'idle' });
  const [pending, start] = useTransition();

  function runPing() {
    setPing({ phase: 'waiting' });
    start(async () => {
      const sent = await sendInboundPing();
      if (!sent.ok || !sent.sentAt) {
        setPing({ phase: 'error', message: sent.error ?? 'השליחה נכשלה' });
        return;
      }
      // עד דקה: שרשרת Resend ← MX ← Cloudflare ← Worker לוקחת בדרך כלל כמה שניות
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const result = await checkInboundPing(sent.sentAt);
        if (result.arrived) {
          setPing({ phase: 'ok' });
          return;
        }
        if (attempt === 19) setPing({ phase: 'timeout', since: result.since });
      }
    });
  }

  return (
    <section className="mt-8" aria-labelledby="inbound-diag-heading">
      <h2 id="inbound-diag-heading" className="mb-1 font-serif text-[1.25rem] text-ink">
        קליטת תשובות במייל — אבחון
      </h2>
      <p className="admin-field-hint mb-3 max-w-[70ch]">
        מוודא שתשובה של פונה או של איש צוות מגיעה לשרשור הפנייה. «אין שורה ביומן» פירושו שהמייל לא הגיע
        לאתר בכלל (Cloudflare או ה-Worker); שורה עם «נדחה» או «נכשל» אומרת איפה ולמה הוא נעצר.
      </p>

      <div className="admin-card mb-4 p-4">
        <h3 className="admin-field-label mb-2">בדיקות הגדרה</h3>
        <ul className="space-y-2">
          {initial.checks.map((check) => (
            <li key={check.key} className="flex items-start gap-2 text-small">
              <span
                className={`admin-badge mt-0.5 shrink-0 ${check.ok ? 'admin-badge-success' : 'admin-badge-danger'}`}
              >
                {check.ok ? 'תקין' : 'חסר'}
              </span>
              <span>
                <span className="font-semibold text-ink">{check.label}</span>
                <span className="block break-all text-muted">{check.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-card mb-4 p-4">
        <h3 className="admin-field-label mb-1">בדיקה מקצה לקצה</h3>
        <p className="admin-field-hint mb-3 max-w-[70ch]">
          שולח מייל מהאתר אל כתובת קליטה ייעודית ומחכה (עד דקה) שיופיע ביומן. הצלחה פירושה שכל השרשרת
          עובדת: ספק השליחה ← MX ← Cloudflare ← ה-Worker ← האתר ← המסד. הבדיקה אינה נוגעת בשום פנייה.
        </p>
        <button
          type="button"
          onClick={runPing}
          disabled={pending || !initial.pingAddress}
          className="admin-btn admin-btn-solid"
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : null}
          הרצת בדיקה
        </button>

        <div role="status" aria-live="polite" className="mt-3 text-small">
          {ping.phase === 'waiting' ? <p className="text-muted">נשלח. ממתין להגעה ליומן…</p> : null}
          {ping.phase === 'ok' ? (
            <p className="font-semibold text-[var(--admin-success)]">
              ✓ המייל הגיע עד האתר. הקליטה עובדת מקצה לקצה.
            </p>
          ) : null}
          {ping.phase === 'error' ? <p className="text-[var(--admin-danger)]">{ping.message}</p> : null}
          {ping.phase === 'timeout' ? (
            <div className="text-[var(--admin-danger)]">
              <p className="font-semibold">המייל לא הגיע ליומן תוך דקה.</p>
              {ping.since.some((row) => row.outcome === 'unauthorized') ? (
                <p>
                  ה-Worker הגיע לאתר אך הסוד שונה: INBOUND_SECRET ב-Worker חייב להיות זהה ל-
                  INBOUND_EMAIL_SECRET באתר.
                </p>
              ) : ping.since.length > 0 ? (
                <p>
                  הגיע ניסיון אחר ({ping.since[0].outcome}
                  {ping.since[0].reason ? `: ${ping.since[0].reason}` : ''}) אך לא בדיקת הקליטה.
                </p>
              ) : (
                <ul className="mt-1 list-disc ps-5 font-normal">
                  <li>Cloudflare ← Email Routing ← Settings: האם Subaddressing מופעל?</li>
                  <li>Routing rules: האם contact@ מופנה ל-<strong>Worker</strong> (ולא לתיבת דואר)?</li>
                  <li>
                    ב-Worker: האם INBOUND_URL הוא {initial.workerUrl ?? '…/api/email/inbound'}, ו-
                    STAFF_INBOX מאומת ב-Destination addresses?
                  </li>
                  <li>Cloudflare ← Workers ← Logs: האם נרשמה הרצה? מה השגיאה?</li>
                  <li>Resend ← Emails: האם ההודעה אל {initial.pingAddress} סומנה Delivered?</li>
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="admin-card admin-table-wrap">
        <table className="admin-table w-full min-w-[52rem] text-small">
          <caption className="px-4 pt-3 text-start admin-field-label">ניסיונות קליטה אחרונים</caption>
          <thead>
            <tr>
              <th scope="col" className="px-4 py-3 text-start">התקבל</th>
              <th scope="col" className="px-4 py-3 text-start">מאת</th>
              <th scope="col" className="px-4 py-3 text-start">תוצאה</th>
              <th scope="col" className="px-4 py-3 text-start">פירוט</th>
            </tr>
          </thead>
          <tbody>
            {initial.log.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-muted">
                  עדיין לא התקבל אף ניסיון. אם נשלחה תשובה — היא לא הגיעה לאתר.
                </td>
              </tr>
            ) : (
              initial.log.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-2.5 tabular-nums text-muted">
                    {formatAdminDate(row.received_at, 'dateTime')}
                  </td>
                  <td dir="ltr" className="px-4 py-2.5 text-start">{row.sender ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`admin-badge ${OUTCOME[row.outcome]?.badge ?? ''}`}>
                      {OUTCOME[row.outcome]?.label ?? row.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{explain(row)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
