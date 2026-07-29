import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MobileNav } from './MobileNav';
import { LocaleSwitch } from './LocaleSwitch';
import { SearchLauncher } from './SearchLauncher';
import { Wordmark } from './Wordmark';
import type { SiteSettings } from '@/lib/supabase/types';

export const MAIN_NAV = [
  { href: '/about', key: 'about' },
  { href: '/books', key: 'books' },
  { href: '/activities', key: 'activities' },
  { href: '/events', key: 'events' },
  { href: '/donate', key: 'donate' },
  { href: '/contact', key: 'contact' },
] as const;

/**
 * כותרת האתר.
 *
 * שורה אחת נמוכה: הסמל בצד הפתיחה, הניווט במרכז, חיפוש והחלפת שפה בקצה.
 * הכותרת אינה דביקה ואינה מצטמצמת בגלילה — תנועה בכותרת מושכת את העין
 * מהתוכן, וזה בדיוק ההפך מהמבוקש.
 */
export async function SiteHeader({ settings }: { settings: SiteSettings }) {
  const t = await getTranslations();

  return (
    <header className="relative z-30 border-b border-rule bg-cream">
      <div className="mx-auto flex w-full max-w-[82rem] items-center gap-6 px-5 py-3.5 sm:px-8">
        <Wordmark
          logoUrl={settings.logo_url}
          name={t('site.name')}
          tagline={t('site.tagline')}
        />

        <nav aria-label={t('nav.menu')} className="mx-auto hidden lg:block">
          <ul className="flex items-center gap-7">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="relative py-2 text-small text-ink-soft transition-colors hover:text-burgundy"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ms-auto flex items-center gap-4 lg:ms-0">
          <div className="hidden items-center gap-4 lg:flex">
            <SearchLauncher />
            <span aria-hidden="true" className="h-4 w-px bg-rule-strong" />
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
