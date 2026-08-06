'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useLocalList } from '@/lib/client-hooks';
import { FavouriteIcon } from '@/components/FavouriteIcon';

/**
 * צמד הכניסות המהירות בכותרת (דרישת 1.1): אייקון ספר אל "הספרים
 * שאהבתי" — עם מונה חי מהמכשיר — ואייקון חשבון (רק כשהחשבונות פעילים).
 * אותה שפה חזותית כמו מונה הסל שלצידם.
 */
export function FavouritesIndicator() {
  const t = useTranslations('store');
  const { list } = useLocalList('kr:favourites');

  return (
    <Link
      href="/favourites"
      aria-label={t('favouritesAria', { count: list.length })}
      className="relative rounded-[var(--radius-pill)] p-2 text-ink-soft transition-colors hover:text-burgundy"
    >
      <FavouriteIcon active={false} className="h-5 w-5" />
      {list.length > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -end-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-[var(--radius-pill)] bg-gold px-1 text-[0.65rem] font-bold leading-none text-navy tabular-nums"
        >
          {list.length > 99 ? '99+' : list.length}
        </span>
      ) : null}
    </Link>
  );
}

export function AccountIndicator() {
  const t = useTranslations('store');
  return (
    <Link
      href="/account"
      aria-label={t('accountAria')}
      className="rounded-[var(--radius-pill)] p-2 text-ink-soft transition-colors hover:text-burgundy"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <circle cx="12" cy="8.2" r="3.4" />
        <path d="M5 19.5c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" />
      </svg>
    </Link>
  );
}
