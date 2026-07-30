import { getTranslations } from 'next-intl/server';
import { MobileNav } from './MobileNav';
import { NavLinks } from './NavLinks';
import { LocaleSwitch } from './LocaleSwitch';
import { SearchLauncher } from './SearchLauncher';
import { Wordmark } from './Wordmark';
import type { SiteSettings } from '@/lib/supabase/types';

export const MAIN_NAV = [
  { href: '/about', key: 'about' },
  { href: '/books', key: 'books' },
  { href: '/activities', key: 'activities' },
  { href: '/events', key: 'events' },
  { href: '/contact', key: 'contact' },
] as const;

/**
 * ניווט צף מזכוכית.
 *
 * הוא אינו פס אטום בראש הדף אלא משטח שמרחף מעליו: blur אמיתי, שקיפות
 * נמוכה, מסגרת דקה וקו אור עליון — כך שהתוכן שנגלל מתחתיו נרמז ולא נחתך.
 * sticky ולא fixed, כדי שהוא ישתתף בזרימת המסמך ולא יסתיר תוכן בעת
 * ניווט לעוגן.
 */
export async function SiteHeader({ settings }: { settings: SiteSettings }) {
  const t = await getTranslations();

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-5">
      <div className="glass mx-auto flex w-full max-w-[82rem] items-center gap-6 rounded-[var(--radius-xl)] px-4 py-2.5 sm:px-6">
        <Wordmark
          logoUrl={settings.logo_url}
          name={t('site.name')}
          tagline={t('site.tagline')}
        />

        <NavLinks
          label={t('nav.menu')}
          items={MAIN_NAV.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }))}
        />

        <div className="ms-auto flex items-center gap-3 lg:ms-0">
          <div className="hidden items-center gap-3 lg:flex">
            <SearchLauncher />
            <LocaleSwitch />
          </div>

          <MobileNav
            items={MAIN_NAV.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }))}
            openLabel={t('nav.openMenu')}
            closeLabel={t('nav.closeMenu')}
            searchLabel={t('books.search')}
          />
        </div>
      </div>
    </header>
  );
}
