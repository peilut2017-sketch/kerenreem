'use client';

import { useEffect } from 'react';
import { usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { recordPageView } from '@/lib/analytics/actions';

/**
 * מתעד צפיה בעמוד ציבורי — בכל טעינה ראשונית וגם בכל ניווט בצד הלקוח,
 * לא רק פעם אחת: כמעט כל ניווט באתר הוא <Link> של Next ולא טעינת דפדפן
 * מלאה, ובלי מעקב אחרי שינוי pathname כל עמוד אחרי הראשון היה "שקוף".
 *
 * usePathname כאן הוא הגרסה המודעת-לשפה מ-i18n/navigation: היא מחזירה
 * את הנתיב בלי קידומת השפה (/books/foo גם בעברית וגם באנגלית), כך שאותו
 * עמוד בשתי השפות נספר תחת אותה שורת "path" ומתבדל דרך עמודת locale
 * נפרדת — לא נספר פעמיים כשתי שורות "עמוד" שונות.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    void recordPageView(pathname, locale, document.referrer || null);
  }, [pathname, locale]);

  return null;
}
