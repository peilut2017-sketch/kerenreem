'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { getResultState, type ResultState } from '@/lib/commerce/checkout-actions';
import { useCart } from '../CartProvider';

/**
 * מצב התוצאה בפועל: נקרא מהשרת ומרוענן כל 3 שניות עד דקה כשעדיין
 * pending (תרשים 19). כל אחד ממצבי פרק 7.5 מקבל מסך משלו; בשום נתיב
 * אין חיוב כפול — ניסיון חוזר ממחזר את אותה הזמנה.
 *
 * הסל מתרוקן *כאן בלבד*, ורק כשההזמנה אכן אושרה — לא ב-Checkout מיד
 * אחרי היצירה. כך כשל/נטישה בדף הסליקה משאירים את הסל שלם ואת אפשרות
 * "ניסיון תשלום חוזר" זמינה (סבב 1.4, קריטי-1).
 */
export function ResultClient({ outcome }: { outcome: string }) {
  const t = useTranslations('store');
  const cart = useCart();
  const [state, setState] = useState<ResultState | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const attempts = useRef(0);
  const cleared = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const result = await getResultState();
        if (cancelled) return;
        setState(result);
        const confirmed = result.found && (outcome === 'created' || result.paymentState === 'paid');
        if (confirmed && !cleared.current) {
          cleared.current = true;
          cart?.clear();
        }
        const pending = result.found && result.paymentState === 'pending' && outcome !== 'created';
        if (pending && attempts.current < 20) {
          attempts.current += 1;
          timer = setTimeout(poll, 3000);
        } else if (pending) {
          setTimedOut(true);
        }
      } catch {
        // [1.4] כשל רשת בקריאה הזו לא אמור לתקוע את העמוד על שלד טעינה
        // נצחי (לא הייתה הגנה כלל) — ניסיון חוזר לפי אותו תקציב כמו
        // "pending", ורק אחריו נופלים לתצוגת "לא ידוע" הקיימת ממילא.
        if (cancelled) return;
        if (attempts.current < 20) {
          attempts.current += 1;
          timer = setTimeout(poll, 3000);
        } else {
          setTimedOut(true);
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // cart נגזר מ-context יציב; אין לרוץ שוב כשהוא מתחלף בזמן הריקון עצמו
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  if (!state) {
    // [1.4] אם לא הצלחנו אף פעם לקבל state (כשלי רשת חוזרים) — אחרי
    // מיצוי הניסיונות עדיף תצוגת "לא ידוע" עם קישור למעקב, לא שלד נצחי
    if (timedOut) {
      return (
        <Shell tone="neutral" title={t('resultUnknownTitle')} body={t('resultUnknownBody', { number: '—' })} t={t} />
      );
    }
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
          <>
            {paid && state.documentState !== 'created' ? (
              <p className="text-small text-muted">{t('resultDocPending')}</p>
            ) : state.promisedDateLabel ? (
              <p className="text-small text-muted">
                {t('deliveryEstimate', { date: state.promisedDateLabel })}
              </p>
            ) : null}
            {/* [1.6] קישור מעקב (ח.12, ביקורת ב.23) — היה חסר לגמרי: עמוד
                התודה לא הוביל לשום מקום שמראה סטטוס חי של ההזמנה */}
            {state.trackToken ? (
              <Link href={`/orders/track/${state.trackToken}`} className="btn btn-quiet">
                {t('resultTrackCta')}
              </Link>
            ) : null}
            {/* ההצעה הממוקדת האחת של עמוד התודה (פרק 16.5): החשבון הפסיבי */}
            {state.accountsEnabled ? (
              <div className="mt-4 rounded-[var(--radius-lg)] border border-gold/40 bg-gold/10 px-6 py-5 text-center">
                <p className="font-serif text-h3 text-ink">{t('accountOfferTitle')}</p>
                <p className="mt-1.5 text-small text-muted">{t('accountOfferBody')}</p>
                <Link href="/account/login" className="btn btn-solid mt-4 inline-block">
                  {t('accountOfferCta')}
                </Link>
              </div>
            ) : null}
          </>
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
