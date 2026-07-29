import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { RichText } from '@/components/RichText';
import { getPageBySlug, getSiteSettings } from '@/lib/data';
import { localized } from '@/lib/localized';

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'donate' });
  return { title: t('title'), description: t('intro') };
}

/**
 * עמוד תרומה — שלב א'.
 *
 * אין כאן סליקה. הסליקה תיפתח בשלב ב' מול ספק ישראלי (Cardcom / Tranzila /
 * Grow), בניתוב צד-שרת, כך שהאתר לא נוגע בפרטי אשראי ואינו נושא באחריות PCI.
 * בינתיים העמוד מסביר את ייעודי התרומה ומפנה למשרד.
 */
export default async function DonatePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tNav, page, settings] = await Promise.all([
    getTranslations('donate'),
    getTranslations('nav'),
    getPageBySlug('donate'),
    getSiteSettings(),
  ]);

  const contact = settings.contact ?? {};
  const purposes = ['book', 'kalla', 'avrech', 'general'] as const;

  return (
    <Container width="text" className="py-14">
      <h1 className="text-h1 text-ink">{t('title')}</h1>
      <p className="mt-4 text-lead leading-relaxed text-muted">{t('intro')}</p>

      <section className="mt-12" aria-labelledby="donate-purposes">
        <h2 id="donate-purposes" className="eyebrow mb-4">
          {t('purposeLabel')}
        </h2>
        <ul className="border-t border-rule">
          {purposes.map((key) => (
            <li key={key} className="border-b border-rule py-3.5 text-ink-soft">
              {t(`purposes.${key}`)}
            </li>
          ))}
        </ul>
      </section>

      {page ? (
        <div className="mt-12">
          <RichText html={localized(page, 'body', locale)} />
        </div>
      ) : null}

      <section className="mt-12 border-t border-rule pt-8">
        <p className="text-ink-soft">{t('onlineSoon')}</p>
        <p className="mt-3 text-small text-muted">{t('contactOffice')}</p>
        <p className="mt-1 text-small text-muted">{t('receiptNote')}</p>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/contact" className="btn btn-solid">
            {tNav('contact')}
          </Link>
          {contact.phone ? (
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link text-small" dir="ltr">
              {contact.phone}
            </a>
          ) : null}
        </div>
      </section>
    </Container>
  );
}
