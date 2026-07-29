import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from './Container';
import { MAIN_NAV } from './SiteHeader';
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
    <footer className="mt-24 border-t border-rule bg-paper-2">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-serif text-[1.25rem] text-ink">{t('site.name')}</p>
            <p className="mt-2 text-small text-muted">{t('footer.founded')}</p>
          </div>

          <nav aria-labelledby="footer-nav-heading">
            <h2 id="footer-nav-heading" className="eyebrow mb-3">
              {t('footer.navHeading')}
            </h2>
            <ul className="space-y-2">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-small text-ink-soft hover:text-burgundy">
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-heading">
            <h2 id="footer-legal-heading" className="eyebrow mb-3">
              {t('footer.legalHeading')}
            </h2>
            <ul className="space-y-2">
              {LEGAL_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-small text-ink-soft hover:text-burgundy">
                    {t(`pages.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow mb-3">{t('footer.contactHeading')}</h2>
            <address className="space-y-2 text-small not-italic text-ink-soft">
              {address ? <p>{address}</p> : null}
              {contact.phone ? (
                <p>
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link">
                    {contact.phone}
                  </a>
                </p>
              ) : null}
              {contact.email ? (
                <p>
                  <a href={`mailto:${contact.email}`} className="link">
                    {contact.email}
                  </a>
                </p>
              ) : null}
            </address>

            {social.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {social.map(([name, url]) => (
                  <li key={name}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
                    >
                      {name}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6">
          <p className="text-caption text-muted">
            © {new Date().getFullYear()} {t('footer.rights')}
          </p>
          {contact.registration_number ? (
            <p className="text-caption text-muted">{contact.registration_number}</p>
          ) : null}
        </div>
      </Container>
    </footer>
  );
}
