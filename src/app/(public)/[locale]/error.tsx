'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ErrorPageShell } from '@/components/ErrorPageShell';

/**
 * תקלת רינדור בעמוד ציבורי.
 *
 * ‏[1.41] באותה מסגרת כמו 404 ועמוד התחזוקה (ErrorPageShell), כדי
 * שהמבקר יראה את אותו אתר בכל מצב ולא שלושה מסכים שונים.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('error');

  // בלי זה השגיאה נבלעה: בפרודקשן ריאקט מסתיר את ההודעה ומשאיר digest,
  // וה-console של הדפדפן הוא המקום היחיד שבו אפשר לקשר אותו ליומן השרת
  useEffect(() => {
    console.error('[site:error]', error.digest ?? '', error);
  }, [error]);

  return (
    <ErrorPageShell
      kind="error"
      title={t('genericTitle')}
      body={t('genericBody')}
      digest={error.digest ?? null}
      actions={
        <button type="button" onClick={reset} className="btn btn-solid">
          {t('retry')}
        </button>
      }
    />
  );
}
