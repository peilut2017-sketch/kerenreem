'use client';

import { useEffect, useRef } from 'react';
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
 *
 * רצועה תחתונה לרוחב המסך, לא כרטיס פינתי: הכרטיס ישב בפינה השמאלית-
 * תחתונה — בדיוק המקום של סרגל הרכישה הצף בעמוד ספר (end בעברית) ושל
 * "חזרה לראש" באנגלית — וכיסה אותם בביקור הראשון, הביקור הקריטי.
 * רצועה אינה מתחרה עם אף פקד פינתי; מה שכן יושב בתחתית מפנה לה מקום
 * דרך המשתנה --consent-h שהיא כותבת על שורש המסמך.
 */
export function CookieConsentBanner() {
  const t = useTranslations('cookies');
  const { value, set } = useLocalValue(COOKIE_CONSENT_KEY);
  const ref = useRef<HTMLDivElement>(null);
  const open = value === null;

  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    if (!node) return;

    const root = document.documentElement;
    const update = () => root.style.setProperty('--consent-h', `${node.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--consent-h');
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label={t('bannerLabel')}
      className="glass fixed inset-x-0 bottom-0 z-40 px-4 py-3 shadow-[0_-10px_30px_-18px_rgb(11_21_32/0.3)] sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-[82rem] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-caption leading-relaxed text-ink-soft">
          {t('message')}{' '}
          <Link href="/privacy" className="link">
            {t('privacyLink')}
          </Link>
        </p>

        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => set('denied')} className="btn btn-quiet px-4 py-1.5 text-caption">
            {t('reject')}
          </button>
          <button type="button" onClick={() => set('granted')} className="btn btn-solid px-4 py-1.5 text-caption">
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
