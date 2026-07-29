import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';

export default async function NotFound() {
  const t = await getTranslations('error');

  return (
    <Container width="text" className="py-24">
      <h1 className="text-h1 text-ink">{t('notFoundTitle')}</h1>
      <p className="mt-4 text-lead text-muted">{t('notFoundBody')}</p>
      <p className="mt-8">
        <Link href="/" className="btn btn-quiet">
          {t('backHome')}
        </Link>
      </p>
    </Container>
  );
}
