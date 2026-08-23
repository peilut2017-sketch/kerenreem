import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';
import { PageHeader } from '@/components/PageHeader';

/**
 * 404 שהוא דרך המשך, לא קיר: כל כניסה לכאן היא מבקר שחיפש משהו קונקרטי.
 * במקום כותרת+כפתור בודד — שלושה יעדי המשך אל האזורים המרכזיים של האתר.
 */
export default async function NotFound() {
  const t = await getTranslations();

  const destinations = [
    { href: '/books', label: t('nav.books') },
    { href: '/events', label: t('nav.events') },
    { href: '/contact', label: t('nav.contact') },
  ] as const;

  return (
    <Container className="py-24">
      <PageHeader title={t('error.notFoundTitle')} intro={t('error.notFoundBody')} />

      <div className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-3">
        {destinations.map((destination) => (
          <Link
            key={destination.href}
            href={destination.href}
            className="card card-interactive items-center p-6 text-center font-serif text-h3 text-ink hover:text-burgundy"
          >
            {destination.label}
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center">
        <Link href="/" className="btn btn-quiet">
          {t('error.backHome')}
        </Link>
      </p>
    </Container>
  );
}
