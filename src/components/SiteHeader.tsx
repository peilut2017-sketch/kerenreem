import { getTranslations } from 'next-intl/server';
import { SiteHeaderClient } from './SiteHeaderClient';
import { getCommerceFlags } from '@/lib/commerce/settings';
import type { SiteSettings } from '@/lib/supabase/types';

export const MAIN_NAV = [
  { href: '/about', key: 'about' },
  { href: '/books', key: 'books' },
  { href: '/activities', key: 'activities' },
  { href: '/events', key: 'events' },
  { href: '/contact', key: 'contact' },
] as const;

/**
 * ניווט משולב-ב-Hero שהופך לזכוכית צפה בגלילה — ראו SiteHeaderClient.tsx
 * לכל ההתנהגות בפועל. הרכיב הזה נשאר שרת: מביא תרגומים ומרכיב רשימת
 * ניווט פשוטה (מחרוזות בלבד), כי המצב הצף/פתוח נקבע בצד הלקוח בלבד.
 */
export async function SiteHeader({ settings }: { settings: SiteSettings }) {
  const [t, flags] = await Promise.all([getTranslations(), getCommerceFlags()]);
  const navItems = MAIN_NAV.map((item) => ({ href: item.href, label: t(`nav.${item.key}`) }));

  return (
    <SiteHeaderClient
      logoUrl={settings.logo_url}
      siteName={t('site.name')}
      tagline={t('site.tagline')}
      navLabel={t('nav.menu')}
      navItems={navItems}
      openLabel={t('nav.openMenu')}
      closeLabel={t('nav.closeMenu')}
      searchLabel={t('books.search')}
      accountsEnabled={flags.accountsEnabled}
    />
  );
}
