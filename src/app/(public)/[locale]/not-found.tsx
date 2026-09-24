import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { ErrorPageShell } from '@/components/ErrorPageShell';

/**
 * ‏404 בתוך עץ השפה — כתובת שנראית כמו עמוד באתר אבל אין לה תוכן.
 *
 * מוגש בתוך הפריסה המלאה (כותרת, ניווט, פוטר, סרגל נגישות), ולכן זה
 * עמוד באתר ולא מסך שגיאה. שתי פעולות ולא אחת: החיפוש קודם לחזרה
 * לעמוד הבית — מי שהגיע לכתובת שגויה חיפש משהו מסוים, והבית אינו
 * מקרב אותו אליו.
 */
export default async function NotFound() {
  const t = await getTranslations('error');

  return (
    <ErrorPageShell
      kind="not-found"
      title={t('notFoundTitle')}
      body={t('notFoundBody')}
      actions={
        <>
          <Link href="/books" className="btn btn-solid">
            {t('notFoundSearch')}
          </Link>
          <Link href="/" className="btn btn-quiet">
            {t('backHome')}
          </Link>
        </>
      }
    />
  );
}
