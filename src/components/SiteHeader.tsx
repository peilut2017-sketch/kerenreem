import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from './Container';
import { MobileNav } from './MobileNav';
import { LocaleSwitch } from './LocaleSwitch';
import type { SiteSettings } from '@/lib/supabase/types';

export const MAIN_NAV = [
  { href: '/books', key: 'books' },
  { href: '/authors', key: 'authors' },
  { href: '/activities', key: 'activities' },
  { href: '/events', key: 'events' },
  { href: '/about', key: 'about' },
  { href: '/contact', key: 'contact' },
] as const;

/**
 * כותרת האתר: שם המכון בסריף בשורה אחת, ניווט שקט מתחתיו, וקו שיער
 * שסוגר. אין באנר, אין לוגו צף, אין תפריט דביק שרודף אחרי הגלילה.
 */
export async function SiteHeader({ settings }: { settings: SiteSettings }) {
  const t = await getTranslations();

  return (
    <header className="relative border-b border-rule bg-paper">
      <Container className="flex items-center justify-between gap-6 py-5">
        <Link href="/" className="group flex items-baseline gap-3 focus-visible:outline-offset-4">
          {settings.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- הלוגו מוגדר ב-CMS ואינו עובר אופטימיזציה
            <img src={settings.logo_url} alt={t('site.name')} className="h-9 w-auto self-center" />
          ) : (
            <span className="font-serif text-[1.5rem] leading-none text-ink group-hover:text-burgundy">
              {t('site.name')}
            </span>
          )}
          <span className="hidden text-caption text-muted sm:inline">{t('site.tagline')}</span>
        </Link>

        <div className="flex items-center gap-5">
          <nav aria-label={t('nav.menu')} className="hidden lg:block">
            <ul className="flex items-center gap-6">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-small text-ink-soft transition-colors hover:text-burgundy"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <span aria-hidden="true" className="h-4 w-px bg-rule-strong" />
            <LocaleSwitch />
            <Link href="/donate" className="btn btn-solid px-4 py-2">
              {t('nav.donate')}
            </Link>
          </div>

          <MobileNav
            items={MAIN_NAV.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }))}
            donateLabel={t('nav.donate')}
            openLabel={t('nav.openMenu')}
            closeLabel={t('nav.closeMenu')}
          />
        </div>
      </Container>
    </header>
  );
}
