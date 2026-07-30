import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';
import { ContactForm } from '@/components/ContactForm';
import { getSiteSettings } from '@/lib/data';

/**
 * חלון קצר במקום שעה, לא בגלל תעבורה אלא בגלל revalidatePath עצמו.
 *
 * נמדד ישירות: קריאה ל-revalidatePath, גם מ-Server Action וגם מ-Route
 * Handler, סימנה את המטמון לרענון אך לא שינתה בפועל את מה שמוגש לבקשה
 * הבאה מדפדפן חדש — נבדק עם Next.js 16.2.12 ובנייה עם Turbopack, שוב
 * ושוב, כולל אחרי המתנה ובקשות חוזרות. יתכן שזו התנהגות שונה בפריסה
 * אמיתית (Vercel), אבל אי אפשר להסתמך על זה בלי דרך לאמת. חלון של דקה
 * מבטיח שתוכן חדש יופיע גם אם הרענון היזום אינו פועל בפועל, ועדיין
 * שומר על מרבית התועלת של מטמון קצה עבור תעבורה אמיתית.
 */
export const revalidate = 60;

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
    <Container className="py-16 lg:py-20">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="mt-12" />

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
