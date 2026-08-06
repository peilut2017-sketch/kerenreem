'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getResultState, type ResultState } from '@/lib/commerce/checkout-actions';

/**
 * מצב התוצאה בפועל: נקרא מהשרת ומרוענן כל 3 שניות עד דקה כשעדיין
 * pending (תרשים 19). כל אחד ממצבי פרק 7.5 מקבל מסך משלו; בשום נתיב
 * אין חיוב כפול — ניסיון חוזר ממחזר את אותה הזמנה.
 */
export function ResultClient({ outcome }: { outcome: string }) {
  const t = useTranslations('store');
  const [state, setState] = useState<ResultState | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      const result = await getResultState();
      if (cancelled) return;
      setState(result);
      const pending = result.found && result.paymentState === 'pending' && outcome !== 'created';
      if (pending && attempts.current < 20) {
        attempts.current += 1;
        timer = setTimeout(poll, 3000);
      } else if (pending) {
        setTimedOut(true);
      }
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [outcome]);

  if (!state) {
    return (
      <div aria-hidden="true" className="mx-auto max-w-md space-y-4">
        <div className="h-8 animate-pulse rounded bg-cream-2" />
        <div className="h-4 animate-pulse rounded bg-cream-2" />
      </div>
    );
  }

  const number = state.orderNumber ?? 0;

  // ההזמנה לא אותרה מה-session (עוגייה פגה) — הודעה ניטרלית, המייל הוא המקור
  if (!state.found) {
    return (
      <Shell
        tone="neutral"
        title={t('resultUnknownTitle')}
        body={t('resultUnknownBody', { number: '—' })}
        t={t}
      />
    );
  }

  if (outcome === 'created' || state.paymentState === 'paid') {
    const paid = state.paymentState === 'paid';
    return (
      <Shell
        tone="success"
        title={paid ? t('resultSuccessTitle') : t('resultNoPaymentTitle')}
        body={paid ? t('resultSuccessBody', { number }) : t('resultNoPaymentBody', { number })}
        extra={
          paid && state.documentState !== 'created' ? (
            <p className="text-small text-muted">{t('resultDocPending')}</p>
          ) : state.promisedDateLabel ? (
            <p className="text-small text-muted">
              {t('deliveryEstimate', { date: state.promisedDateLabel })}
            </p>
          ) : null
        }
        t={t}
      />
    );
  }

  if (state.paymentState === 'failed' || outcome === 'failure') {
    return (
      <Shell
        tone="error"
        title={t('resultFailedTitle')}
        body={t('resultFailedBody')}
        extra={
          <div className="flex flex-col items-center gap-3">
            <Link href="/checkout" className="btn btn-solid">
              {t('resultRetry')}
            </Link>
            {state.supportPhone ? (
              <p className="text-caption text-muted">
                {t('phoneHelp', { phone: state.supportPhone })}
              </p>
            ) : null}
          </div>
        }
        t={t}
      />
    );
  }

  if (timedOut) {
    return (
      <Shell tone="neutral" title={t('resultUnknownTitle')} body={t('resultUnknownBody', { number })} t={t} />
    );
  }

  return (
    <Shell
      tone="neutral"
      title={t('resultProcessingTitle')}
      body={t('resultProcessingBody')}
      spinner
      t={t}
    />
  );
}

function Shell({
  tone,
  title,
  body,
  extra,
  spinner,
  t,
}: {
  tone: 'success' | 'error' | 'neutral';
  title: string;
  body: string;
  extra?: React.ReactNode;
  spinner?: boolean;
  t: ReturnType<typeof useTranslations<'store'>>;
}) {
  return (
    <div role="status" aria-live="polite" className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
      <span
        aria-hidden="true"
        className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
          tone === 'success'
            ? 'bg-gold/20 text-gold-deep'
            : tone === 'error'
              ? 'bg-burgundy/10 text-burgundy'
              : 'bg-cream-2 text-ink-soft'
        }`}
      >
        {spinner ? (
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />
        ) : tone === 'success' ? (
          '✓'
        ) : tone === 'error' ? (
          '!'
        ) : (
          '⋯'
        )}
      </span>
      <h1 className="font-serif text-[clamp(1.5rem,3vw,2rem)] text-ink">{title}</h1>
      <p className="text-lead text-muted">{body}</p>
      {extra}
      <Link href="/books" className="mt-2 text-small text-muted underline-offset-2 hover:text-burgundy hover:underline">
        {t('resultBackToCatalogue')}
      </Link>
    </div>
  );
}
