'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLocalValue } from '@/lib/client-hooks';

export const COOKIE_CONSENT_KEY = 'kr:cookie-consent';

/**
 * באנר הסכמת עוגיות — לא רק הודעה נגישה מבחינה משפטית: הבחירה עצמה
 * חוסמת בפועל. GoogleAnalytics.tsx (עוגיית האנליטיקס היחידה באתר,
 * ראו שם) לא נטען כלל עד ש-value === 'granted'. "רק הכרחיים" שומר
 * denied ולא מוחק כלום — האתר ממשיך לעבוד במלואו, פשוט בלי GA4.
 *
 * הבאנר נעלם ברגע שיש החלטה (value !== null) ולא חוזר בביקור הבא —
 * ראו CookieSettingsButton בפוטר לדרך לשנות החלטה מאוחר יותר, כנדרש
 * (בחירה שאי אפשר לשנות אינה הסכמה חופשית).
 */
export function CookieConsentBanner() {
  const t = useTranslations('cookies');
  const { value, set } = useLocalValue(COOKIE_CONSENT_KEY);

  if (value !== null) return null;

  return (
    <div
      role="region"
      aria-label={t('bannerLabel')}
      className="glass fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[46rem] rounded-[var(--radius-lg)] p-5 shadow-[var(--shadow-float)] sm:inset-x-6 sm:bottom-6 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-[60ch] text-small leading-relaxed text-ink-soft">
          {t('message')}{' '}
          <Link href="/privacy" className="link">
            {t('privacyLink')}
          </Link>
        </p>

        <div className="flex shrink-0 flex-wrap gap-3">
          <button type="button" onClick={() => set('denied')} className="btn btn-quiet">
            {t('reject')}
          </button>
          <button type="button" onClick={() => set('granted')} className="btn btn-solid">
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "הגדרות עוגיות" בפוטר — מאפס את ההחלטה כדי שהבאנר יופיע שוב. */
export function CookieSettingsButton({ label }: { label: string }) {
  const { clear } = useLocalValue(COOKIE_CONSENT_KEY);

  return (
    <button
      type="button"
      onClick={clear}
      className="text-small text-cream-2/80 transition-colors hover:text-gold"
    >
      {label}
    </button>
  );
}
