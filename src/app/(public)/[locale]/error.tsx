'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/Container';

/**
 * גבול השגיאות של האתר הציבורי. "נסו שוב" אינו המוצא היחיד: תקלה שמקורה
 * בנתונים תיכשל שוב ושוב, ובלי "לעמוד הבית"/"יצירת קשר" המבקר לכוד.
 * digest מוצג כקוד תקלה — הדרך היחידה לקשר פנייה של מבקר ליומן השרת.
 */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');

  useEffect(() => {
    // בלי הרישום הזה התקלה לא מותירה שום עקבה בצד הלקוח
    console.error('[public:error-boundary]', error);
  }, [error]);

  return (
    <Container width="text" className="py-24 text-center">
      <h1 className="text-h1 text-ink">{t('genericTitle')}</h1>
      <p className="mt-4 text-lead text-muted">{t('genericBody')}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-solid">
          {t('retry')}
        </button>
        <Link href="/" className="btn btn-quiet">
          {t('backHome')}
        </Link>
        <Link href="/contact" className="btn btn-quiet">
          {t('contactUs')}
        </Link>
      </div>
      {error.digest ? (
        <p className="mt-8 text-caption text-muted">
          {t('errorCode', { code: error.digest })}
        </p>
      ) : null}
    </Container>
  );
}
