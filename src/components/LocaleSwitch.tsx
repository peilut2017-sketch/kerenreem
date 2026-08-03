'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';

/**
 * מעבר בין עברית לאנגלית באותו עמוד. קישור טקסטואלי — לא דגלים
 * (דגל מסמן מדינה, לא שפה) ולא תפריט נפתח עבור שתי אפשרויות.
 */
export function LocaleSwitch({ onDark = false }: { onDark?: boolean }) {
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
      className={`rounded-[var(--radius-pill)] px-3 py-2 text-small font-semibold transition-[background-color,color,transform] duration-300 active:scale-95 ${
        onDark
          ? 'text-cream-2/85 hover:bg-white/10 hover:text-gold-bright'
          : 'text-ink-soft hover:bg-white/70 hover:text-burgundy'
      }`}
    >
      {t('switchToEnglish')}
    </button>
  );
}
