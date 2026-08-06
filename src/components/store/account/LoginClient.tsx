'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendLoginLink } from '@/lib/commerce/account-actions';

/** טופס קישור ההתחברות — מייל בלבד, בלי סיסמאות (פרק 4.4, הנחה A12). */
export function LoginClient({ linkIssue }: { linkIssue: boolean }) {
  const t = useTranslations('store');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error' | 'rate'>('idle');

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        setState('busy');
        const result = await sendLoginLink(email);
        setState(result.ok ? 'sent' : result.error === 'rate_limited' ? 'rate' : 'error');
      }}
      className="mt-8 space-y-4"
    >
      {linkIssue && state === 'idle' ? (
        <p role="alert" className="rounded-[var(--radius-md)] border border-gold/40 bg-gold/10 px-4 py-3 text-small text-ink">
          {t('accountLoginIssue')}
        </p>
      ) : null}

      {state === 'sent' ? (
        <p role="status" className="rounded-[var(--radius-md)] bg-cream-2/80 px-4 py-4 text-center text-small text-ink">
          {t('accountLoginSent')}
        </p>
      ) : (
        <>
          <div>
            <label htmlFor="login-email" className="mb-1.5 block text-small font-semibold text-ink">
              {t('email')}
            </label>
            <input
              id="login-email"
              type="email"
              dir="ltr"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            />
          </div>
          {state === 'error' ? (
            <p role="alert" className="text-caption text-burgundy">{t('errServer')}</p>
          ) : null}
          {state === 'rate' ? (
            <p role="alert" className="text-caption text-burgundy">{t('accountLoginRate')}</p>
          ) : null}
          <button type="submit" disabled={state === 'busy'} className="btn btn-solid w-full">
            {t('accountLoginSend')}
          </button>
        </>
      )}
    </form>
  );
}
