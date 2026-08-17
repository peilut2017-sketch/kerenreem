import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { MAIN_NAV } from './SiteHeader';
import { SocialIcon, SOCIAL_NAMES } from './SocialIcon';
import { Wordmark } from './Wordmark';
import { CookieSettingsButton } from './CookieConsentBanner';
import type { SiteSettings } from '@/lib/supabase/types';

const LEGAL_NAV = [
  { href: '/terms', key: 'terms' },
  { href: '/privacy', key: 'privacy' },
  { href: '/accessibility', key: 'accessibility' },
] as const;

export async function SiteFooter({ settings, locale }: { settings: SiteSettings; locale: string }) {
  const t = await getTranslations();
  const contact = settings.contact ?? {};
  const address = locale === 'en' ? contact.address_en || contact.address_he : contact.address_he;
  const social = Object.entries(settings.social_links ?? {}).filter(([, url]) => Boolean(url));

  return (
    <footer className="on-dark mt-auto">
      <div className="mx-auto w-full max-w-[82rem] px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <Wordmark
              logoUrl={settings.logo_url}
              darkLogoUrl={settings.logo_dark_url}
              name={t('site.name')}
              tagline={t('site.tagline')}
              variant="dark"
            />
            <p className="mt-5 max-w-[34ch] text-small leading-relaxed text-cream-2/70">
              {t('footer.blurb')}
            </p>
          </div>

          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className="eyebrow mb-4">
              {t('footer.navHeading')}
            </h2>
            <ul className="space-y-2.5">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-small text-cream-2/80 transition-colors hover:text-gold"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-heading">
            <h2 id="footer-legal-heading" className="eyebrow mb-4">
              {t('footer.legalHeading')}
            </h2>
            <ul className="space-y-2.5">
              {LEGAL_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-small text-cream-2/80 transition-colors hover:text-gold"
                  >
                    {t(`pages.${item.key}`)}
                  </Link>
                </li>
              ))}
              <li>
                <CookieSettingsButton label={t('footer.cookieSettings')} />
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow mb-4">{t('footer.contactHeading')}</h2>
            <address className="space-y-2.5 text-small not-italic text-cream-2/80">
              {address ? <p>{address}</p> : null}
              {contact.phone ? (
                <p>
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                    dir="ltr"
                    className="transition-colors hover:text-gold"
                  >
                    {contact.phone}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p>
                  <a
                    href={`mailto:${contact.email}`}
                    dir="ltr"
                    className="transition-colors hover:text-gold"
                  >
                    {contact.email}
                  </a>
                </p>
              ) : null}
            </address>

            {/* [1.11] לוגו הרשת במקום שם הרשת כטקסט — SocialIcon.tsx */}
            {social.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {social.map(([name, url]) => (
                  <li key={name}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={SOCIAL_NAMES[name] ?? name}
                      title={SOCIAL_NAMES[name] ?? name}
                      className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] border border-white/15 text-cream-2/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold motion-reduce:transform-none"
                    >
                      <SocialIcon name={name} className="h-4.5 w-4.5" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-white/12 pt-7">
          <p className="text-caption text-cream-2/60">
            © {new Date().getFullYear()} {t('footer.rights')}
          </p>
          <p className="text-caption text-cream-2/60">
            {contact.registration_number ? `${contact.registration_number} · ` : ''}
            <a
              href="https://smartop-azure.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 transition-colors hover:text-gold"
            >
              {t('footer.credit')}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
