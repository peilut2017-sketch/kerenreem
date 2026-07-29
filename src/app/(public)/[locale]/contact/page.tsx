import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { ContactForm } from '@/components/ContactForm';
import { getSiteSettings } from '@/lib/data';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contact' });
  return { title: t('title'), description: t('intro') };
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tPages, settings] = await Promise.all([
    getTranslations('contact'),
    getTranslations('pages'),
    getSiteSettings(),
  ]);

  const contact = settings.contact ?? {};
  const address = locale === 'en' ? contact.address_en || contact.address_he : contact.address_he;

  return (
    <Container className="py-14">
      <header className="mb-10 max-w-[52ch]">
        <h1 className="text-h1 text-ink">{t('title')}</h1>
        <p className="mt-3 text-lead text-muted">{t('intro')}</p>
      </header>

      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-20">
        <ContactForm />

        <aside className="lg:border-s lg:border-rule lg:ps-10">
          <h2 className="eyebrow mb-4">{t('details')}</h2>
          <dl className="space-y-4 text-small">
            {address ? (
              <div>
                <dt className="text-muted">{t('address')}</dt>
                <dd className="mt-1 text-ink-soft">{address}</dd>
              </div>
            ) : null}
            {contact.phone ? (
              <div>
                <dt className="text-muted">{t('phoneLabel')}</dt>
                <dd className="mt-1">
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link" dir="ltr">
                    {contact.phone}
                  </a>
                </dd>
              </div>
            ) : null}
            {contact.email ? (
              <div>
                <dt className="text-muted">{t('emailLabel')}</dt>
                <dd className="mt-1">
                  <a href={`mailto:${contact.email}`} className="link" dir="ltr">
                    {contact.email}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>

          <p className="mt-8 text-caption leading-relaxed text-muted">
            <Link href="/privacy" className="link">
              {tPages('privacy')}
            </Link>
          </p>
        </aside>
      </div>
    </Container>
  );
}
