'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * מעבר בין עברית לאנגלית באותו עמוד. קישור טקסטואלי — לא דגלים
 * (דגל מסמן מדינה, לא שפה) ולא תפריט נפתח עבור שתי אפשרויות.
 */
export function LocaleSwitch() {
  const locale = useLocale();
  const t = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();

  const target = locale === 'he' ? 'en' : 'he';

  return (
    <button
      type="button"
      disabled={isPending}
      lang={target}
      onClick={() => {
        startTransition(() => {
          // @ts-expect-error -- pathname מטופס לפי מסלולים ידועים; פרמטרים דינמיים מועברים כפי שהם
          router.replace({ pathname, params }, { locale: target });
        });
      }}
      className="text-small text-muted underline decoration-rule-strong underline-offset-4 transition-colors hover:text-burgundy"
    >
      {t('switchToEnglish')}
    </button>
  );
}
