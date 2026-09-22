'use client';

import { useState, useTransition } from 'react';
import {
  previewSiteEmail,
  sendTestSiteEmail,
  type EmailActionResult,
} from '@/lib/admin/email-actions';
import { SITE_EMAIL_TEMPLATES, type SiteEmailTemplate } from '@/lib/email/template-list';
import { AdminIcon } from './AdminIcons';
import { Spinner } from './SubmitButton';

/**
 * [1.40] תצוגה מקדימה ושליחת בדיקה לכל תבנית דואר.
 *
 * התצוגה היא iframe עם srcDoc ולא הזרקת HTML לעמוד: הודעת דואר היא
 * מסמך שלם משלה (‎<html>, ‎<body>, רקע, רוחב קבוע), והזרקתה לתוך מסך
 * הניהול הייתה גם שוברת את הפריסה וגם נותנת תצוגה שאינה נאמנה למה
 * שהנמען יראה. ה-iframe מקבל sandbox ריק — שום סקריפט ושום ניווט
 * מתוך תוכן שנועד להישלח החוצה.
 */
export function EmailTester({ defaultTo }: { defaultTo: string }) {
  const [template, setTemplate] = useState<SiteEmailTemplate>('password_reset');
  const [preview, setPreview] = useState<EmailActionResult | null>(null);
  const [to, setTo] = useState(defaultTo);
  const [sendState, setSendState] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadingPreview, startPreview] = useTransition();
  const [sending, startSend] = useTransition();

  function loadPreview(next: SiteEmailTemplate) {
    setTemplate(next);
    setSendState(null);
    startPreview(async () => setPreview(await previewSiteEmail(next)));
  }

  function send() {
    setSendState(null);
    startSend(async () => {
      const result = await sendTestSiteEmail(template, to);
      setSendState(
        result.ok
          ? { ok: true, message: `נשלח אל ${to}. אם ההודעה לא הגיעה תוך דקה — בדקו בתיקיית דואר הזבל.` }
          : { ok: false, message: result.error ?? 'השליחה נכשלה' },
      );
    });
  }

  return (
    <div className="space-y-5">
      <div className="admin-card p-4">
        <label htmlFor="email-template" className="admin-field-label">
          תבנית
        </label>
        <select
          id="email-template"
          value={template}
          onChange={(event) => loadPreview(event.target.value as SiteEmailTemplate)}
          className="admin-field-input mt-1 sm:!w-80"
        >
          {SITE_EMAIL_TEMPLATES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <p className="admin-field-hint">
          התצוגה והשליחה משתמשות בנתוני דוגמה בלבד — שום פנייה, הזמנה או חשבון אמיתיים אינם
          נקראים ואינם משתנים.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-rule pt-4">
          <div>
            <label htmlFor="email-to" className="admin-field-label">
              שליחת בדיקה אל
            </label>
            <input
              id="email-to"
              type="email"
              dir="ltr"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="admin-field-input mt-1 sm:!w-72"
            />
          </div>
          <button
            type="button"
            onClick={send}
            disabled={sending || to.trim() === ''}
            className="admin-btn admin-btn-solid"
          >
            {sending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="messages" className="h-4 w-4" />}
            שליחת בדיקה
          </button>
          {!preview ? (
            <button
              type="button"
              onClick={() => loadPreview(template)}
              className="admin-btn admin-btn-quiet"
            >
              <AdminIcon name="view" className="h-4 w-4" />
              תצוגה מקדימה
            </button>
          ) : null}
        </div>

        {sendState ? (
          <p
            role={sendState.ok ? 'status' : 'alert'}
            className={`mt-3 text-small ${sendState.ok ? 'text-[var(--admin-success)]' : 'text-[var(--admin-danger)]'}`}
          >
            {sendState.message}
          </p>
        ) : null}
      </div>

      {loadingPreview ? (
        <p role="status" className="inline-flex items-center gap-2 text-small text-muted">
          <Spinner className="h-3.5 w-3.5" /> בונה תצוגה מקדימה…
        </p>
      ) : preview?.html ? (
        <div className="admin-card overflow-hidden">
          <p className="border-b border-rule px-4 py-2.5 text-small text-ink-soft">
            <span className="text-muted">נושא: </span>
            {preview.subject}
          </p>
          <iframe
            title="תצוגה מקדימה של ההודעה"
            srcDoc={preview.html}
            sandbox=""
            className="h-[38rem] w-full border-0 bg-white"
          />
        </div>
      ) : preview?.error ? (
        <p role="alert" className="text-small text-[var(--admin-danger)]">
          {preview.error}
        </p>
      ) : null}
    </div>
  );
}
