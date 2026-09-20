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
 *
 * end-4 לוגי ולא left-4 פיזי: בצד start יושב טור הלחצנים הצפים (נגישות,
 * דיווח, חזרה למעלה) בשני הלוקיילים; left-4 פיזי כיסה אותו באנגלית (שם
 * start=left) — מבקר אנגלי לא הגיע לסרגל הנגישות עד שדחה את העוגיות.
 * סרגל הקנייה של עמוד הספר (end-6) מתרומם מעל הבאנר בשני הלוקיילים.
 * כרטיס קטן ולא רצועה על פני כל הרוחב, כדי להסתיר כמה שפחות מהתוכן
 * מתחתיו; זה עדיין כולל את כל מה שנדרש (הסבר, קישור למדיניות הפרטיות,
 * אישור ודחייה) — הצמצום הוא בגודל ובמיקום, לא בתוכן המשפטי הנדרש.
 */
export function CookieConsentBanner() {
  const t = useTranslations('cookies');
  const { value, set } = useLocalValue(COOKIE_CONSENT_KEY);

  if (value !== null) return null;

  return (
    <div
      role="region"
      aria-label={t('bannerLabel')}
      className="glass fixed bottom-4 end-4 z-50 w-[calc(100vw-2rem)] max-w-[19rem] rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-float)]"
    >
      <p className="text-caption leading-relaxed text-ink-soft">
        {t('message')}{' '}
        <Link href="/privacy" className="link">
          {t('privacyLink')}
        </Link>
      </p>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => set('denied')} className="btn btn-quiet flex-1 px-3 py-1.5 text-caption">
          {t('reject')}
        </button>
        <button type="button" onClick={() => set('granted')} className="btn btn-solid flex-1 px-3 py-1.5 text-caption">
          {t('accept')}
        </button>
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
