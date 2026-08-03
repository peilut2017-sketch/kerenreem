import { getLocale, getTranslations } from 'next-intl/server';
import { Container } from './Container';
import { RichText } from './RichText';
import { getPageBySlug, getSiteSettings } from '@/lib/data';
import { localized } from '@/lib/localized';
import { formatDate, parseDateOnly } from '@/lib/hebrew-date';
import { renderLegalTemplate } from '@/lib/legal-template';

/**
 * עמוד תוכן הנערך ב-CMS (אודות, תקנון, פרטיות, נגישות).
 *
 * תאריך העדכון נלקח מ-updated_at ומוצג בעמודים המשפטיים — דרישה מהותית
 * במדיניות פרטיות ובהצהרת נגישות, ומתעדכן מאליו בכל עריכה.
 *
 * getSiteSettings נשלף כאן עבור כל עמוד תוכן ולא רק העמודים המשפטיים,
 * כדי ש-renderLegalTemplate יוכל להציב {{token}} (מספר עמותה, טלפון,
 * דוא"ל, כתובת) מהגדרות האתר בתוך הגוף — בעמודים בלי tokens זה no-op.
 */
export async function ContentPageView({
  slug,
  fallbackTitle,
  showUpdated = false,
}: {
  slug: string;
  fallbackTitle: string;
  /** להפעיל בעמודים המשפטיים, שבהם תאריך הגרסה הוא חלק מהמסמך. */
  showUpdated?: boolean;
}) {
  const [page, settings, locale, t] = await Promise.all([
    getPageBySlug(slug),
    getSiteSettings(),
    getLocale(),
    getTranslations('pages'),
  ]);

  if (!page) {
    return (
      <Container width="text" className="py-14">
        <h1 className="text-h1 text-ink">{fallbackTitle}</h1>
        <p className="mt-4 text-muted">{t('missing')}</p>
      </Container>
    );
  }

  const updated = parseDateOnly(page.updated_at);

  return (
    <Container width="text" className="py-14">
      <h1 className="text-h1 text-ink">{localized(page, 'title', locale)}</h1>
      {showUpdated && updated ? (
        <p className="mt-3 text-caption text-muted">
          {t('lastUpdated', { date: formatDate(updated, locale, 'both') })}
        </p>
      ) : null}
      <div className="mt-10">
        <RichText html={renderLegalTemplate(localized(page, 'body', locale), settings, locale)} />
      </div>
    </Container>
  );
}
