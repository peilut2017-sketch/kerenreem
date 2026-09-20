'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Container } from '@/components/Container';

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');

  // בלי זה השגיאה נבלעה: בפרודקשן ריאקט מסתיר את ההודעה ומשאיר digest,
  // וה-console של הדפדפן הוא המקום היחיד שבו אפשר לקשר אותו ליומן השרת
  useEffect(() => {
    console.error('[site:error]', error.digest ?? '', error);
  }, [error]);

  return (
    <Container width="text" className="py-24">
      <h1 className="text-h1 text-ink">{t('genericTitle')}</h1>
      <p className="mt-4 text-lead text-muted">{t('genericBody')}</p>
      {error.digest ? (
        <p className="mt-3 font-mono text-caption text-muted" dir="ltr">
          {error.digest}
        </p>
      ) : null}
      <button type="button" onClick={reset} className="btn btn-quiet mt-8">
        {t('retry')}
      </button>
    </Container>
  );
}
