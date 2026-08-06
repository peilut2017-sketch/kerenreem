'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { requestCancelByToken } from '@/lib/commerce/track-actions';

/**
 * בקשת ביטול מעמוד המעקב — מוצגת רק כשההזמנה עדיין זכאית (לפני משלוח).
 * הבקשה נפתחת לצוות, אינה מבטלת אוטומטית; התמצית המשפטית — בתקנון.
 */
export function TrackCancelRequest({ token }: { token: string }) {
  const t = useTranslations('store');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [pending, startTransition] = useTransition();

  if (state === 'sent') {
    return (
      <p role="status" className="mt-6 rounded-[var(--radius-md)] bg-cream-2/70 px-4 py-3 text-center text-small text-ink">
        {t('cancelRequestSent')}
      </p>
    );
  }

  return (
    <div className="mt-6 text-center">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-small text-muted underline-offset-2 hover:text-burgundy hover:underline"
        >
          {t('cancelRequestOpen')}
        </button>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const result = await requestCancelByToken(token, reason);
              setState(result.ok ? 'sent' : 'error');
            });
          }}
          className="mx-auto max-w-md space-y-3 text-start"
        >
          <label htmlFor="cancel-reason" className="block text-small font-semibold text-ink">
            {t('cancelRequestReason')}
          </label>
          <textarea
            id="cancel-reason"
            rows={2}
            maxLength={300}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
          />
          {state === 'error' ? (
            <p role="alert" className="text-caption text-burgundy">
              {t('cancelRequestError')}
            </p>
          ) : null}
          <div className="flex gap-3">
            <button type="submit" disabled={pending || !reason.trim()} className="btn btn-solid">
              {t('cancelRequestSubmit')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
              {t('close')}
            </button>
          </div>
          <p className="text-caption text-muted">{t('cancelPolicyBrief')}</p>
        </form>
      )}
    </div>
  );
}
