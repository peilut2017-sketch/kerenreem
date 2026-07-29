'use client';

import { useTranslations } from 'next-intl';
import { Container } from '@/components/Container';

export default function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('error');

  return (
    <Container width="text" className="py-24">
      <h1 className="text-h1 text-ink">{t('genericTitle')}</h1>
      <p className="mt-4 text-lead text-muted">{t('genericBody')}</p>
      <button type="button" onClick={reset} className="btn btn-quiet mt-8">
        {t('retry')}
      </button>
    </Container>
  );
}
