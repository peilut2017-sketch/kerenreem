'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendLoginLink } from '@/lib/commerce/account-actions';

/**
 * טופס קישור ההתחברות — מייל בלבד, בלי סיסמאות (פרק 4.4, הנחה A12).
 * claimToken (מ-?claim= בקישור המעקב/עמוד התודה) נשמר מקומית כדי לשרוד
 * את מסע קישור-הקסם, ונמסר ל-completeLogin בכניסה לאזור האישי — עוגן
 * ה-Claim הבטוח של תרשים 18.
 */
export function LoginClient({
  linkIssue,
  claimToken = null,
}: {
  linkIssue: boolean;
  claimToken?: string | null;
}) {
  const t = useTranslations('store');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error' | 'rate'>('idle');
  // השהיית שליחה חוזרת — נגד הצפה, ומסונכרנת עם ההגבלה בשרת
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!claimToken) return;
    try {
      window.localStorage.setItem('kr:claim', claimToken);
    } catch {
      // אחסון חסום — ה-Claim ייפול חזרה לעוגן עוגיית ה-checkout
    }
  }, [claimToken]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function send() {
    setState('busy');
    try {
      const result = await sendLoginLink(email);
      if (result.ok) {
        setState('sent');
        setCooldown(60);
      } else {
        setState(result.error === 'rate_limited' ? 'rate' : 'error');
      }
    } catch {
      // בלי catch, כשל רשת אמיתי (throw) השאיר את state על 'busy' לנצח —
      // כפתור מושבת בלי שום הודעה. אותו דפוס [1.4] כמו בטפסי הקופה.
      setState('error');
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
      className="mt-8 space-y-4"
    >
      {linkIssue && state === 'idle' ? (
        <p role="alert" className="rounded-[var(--radius-md)] border border-gold/40 bg-gold/10 px-4 py-3 text-small text-ink">
          {t('accountLoginIssue')}
        </p>
      ) : null}

      {state === 'sent' ? (
        /* לא מסך סופי: טעות הקלדה במייל ("gmial") הייתה מבוי סתום — אין
           תיקון כתובת ואין שליחה חוזרת בלי רענון ידני של העמוד. */
        <div className="rounded-[var(--radius-md)] bg-cream-2/80 px-4 py-4 text-center text-small text-ink">
          <p role="status">{t('accountLoginSent')}</p>
          <p className="mt-1.5 text-caption text-muted" dir="ltr">
            {email}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            <button
              type="button"
              onClick={() => setState('idle')}
              className="text-caption text-burgundy underline underline-offset-2"
            >
              {t('accountLoginChangeEmail')}
            </button>
            <button
              type="button"
              disabled={cooldown > 0}
              onClick={() => void send()}
              className="text-caption text-muted underline underline-offset-2 hover:text-ink disabled:no-underline disabled:opacity-70"
            >
              {cooldown > 0
                ? t('accountLoginResendIn', { seconds: cooldown })
                : t('accountLoginResend')}
            </button>
          </div>
        </div>
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
