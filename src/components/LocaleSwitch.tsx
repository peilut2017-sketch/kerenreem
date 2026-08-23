'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * מעבר בין עברית לאנגלית באותו עמוד. קישור טקסטואלי — לא דגלים
 * (דגל מסמן מדינה, לא שפה) ולא תפריט נפתח עבור שתי אפשרויות.
 *
 * ה-query string עובר יחד עם הנתיב: usePathname של next-intl מחזיר
 * נתיב בלבד, ובלי ההשלמה הזו מי שסינן את הקטלוג (?q=…&category=…)
 * והחליף שפה נחת בקטלוג ריק — כל הסינון נמחק במעבר.
 */
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const target = locale === 'he' ? 'en' : 'he';

  return (
    <button
      type="button"
      disabled={isPending}
      aria-busy={isPending || undefined}
      lang={target}
      onClick={() => {
        startTransition(() => {
          const query = Object.fromEntries(searchParams.entries());
          // @ts-expect-error -- pathname מטופס לפי מסלולים ידועים; פרמטרים דינמיים מועברים כפי שהם
          router.replace({ pathname, params, query }, { locale: target });
        });
      }}
      className="inline-flex min-h-11 items-center rounded-[var(--radius-pill)] px-3 py-2 text-small font-semibold text-ink-soft transition-[background-color,color,transform] duration-300 hover:bg-white/70 hover:text-burgundy active:scale-95 disabled:opacity-60"
    >
      {isPending ? (
        <span
          aria-hidden="true"
          className="me-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {t('switchToEnglish')}
    </button>
  );
}
