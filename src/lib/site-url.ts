/**
 * [1.40] כתובת האתר הקנונית — מקור אמת אחד.
 *
 * הבעיה שזה פותר, מדודה בשטח: sitemap.xml פרסם את כתובת הפריסה של
 * Vercel (…​.vercel.app) במקום את הדומיין של המכון. כל עמוד ב-sitemap,
 * כל תג canonical וכל hreflang הצביעו על דומיין שאינו הדומיין
 * שמפרסמים — מנועי חיפוש מתייחסים לזה כאתר כפול, וקישורי איפוס סיסמה
 * ומעקב הזמנות שנשלחו במייל הוציאו את המקבלים מהאתר הנכון.
 *
 * הסיבה היא שכל מקום בקוד קרא את NEXT_PUBLIC_SITE_URL ישירות, וכשהוא
 * לא הוגדר (או הוגדר לכתובת הפריסה) שום דבר לא עצר את זה. שלוש
 * שכבות הגנה כאן:
 *
 *  1. **סינון דומיין פריסה.** כתובת שמסתיימת ב-.vercel.app היא כתובת
 *     תצוגה מקדימה, לא הכתובת הציבורית — היא נדחית גם כשהיא מוגדרת
 *     במפורש, ובמקומה נלקחת הכתובת הקנונית.
 *  2. **נפילה חזרה מפורשת.** CANONICAL_FALLBACK הוא הדומיין של המכון,
 *     כתוב בקוד בכוונה: זה הערך הנכון גם כשההגדרות ריקות, ועדיף
 *     דומיין נכון מקידוד קשיח על דומיין שגוי מהגדרה.
 *  3. **נרמול.** בלי לוכסן מסיים, https בכפייה בייצור — כך ששתי
 *     הגדרות שנראות שונות מייצרות אותה כתובת בדיוק.
 *
 * בפיתוח מקומי הכתובת היא localhost כרגיל, כי שם דווקא *רוצים* את
 * הכתובת המקומית.
 */

/**
 * הדומיין הציבורי של האתר. משמש כשאין NEXT_PUBLIC_SITE_URL תקין.
 * לשינוי רק יחד עם הדומיין עצמו.
 */
const CANONICAL_FALLBACK = 'https://www.kerenreem.org';

/** דומיינים שהם תמיד סביבת פריסה/תצוגה מקדימה ולא הכתובת הציבורית. */
const DEPLOYMENT_HOST_SUFFIXES = ['.vercel.app', '.netlify.app', '.pages.dev'];

function isLocal(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');
}

function isDeploymentHost(hostname: string): boolean {
  return DEPLOYMENT_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

/** נרמול: בלי לוכסן מסיים, בלי query/hash, https מחוץ לפיתוח מקומי. */
function normalise(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!isLocal(url.hostname)) url.protocol = 'https:';
    return `${url.origin}`;
  } catch {
    return null;
  }
}

/**
 * הכתובת שכל קישור ציבורי, canonical, sitemap ומייל צריכים להשתמש בה.
 * תמיד בלי לוכסן מסיים.
 */
export function canonicalSiteUrl(): string {
  const configured = normalise(process.env.NEXT_PUBLIC_SITE_URL ?? '');
  if (!configured) return CANONICAL_FALLBACK;

  const { hostname } = new URL(configured);
  if (isLocal(hostname)) return configured;
  if (isDeploymentHost(hostname)) return CANONICAL_FALLBACK;
  return configured;
}

/**
 * דיווח מצב, לבדיקת התקינות ולמסך האבחון: מה הוגדר, מה בפועל בשימוש,
 * ולמה. בלי זה, "ה-sitemap מפרסם את הכתובת הלא נכונה" הוא דבר שמתגלה
 * רק כשמישהו פותח את הקובץ בעיניים.
 */
export interface CanonicalUrlStatus {
  configured: string | null;
  effective: string;
  /** true כשההגדרה נדחתה והכתובת נלקחה מהנפילה חזרה. */
  overridden: boolean;
  reason: 'ok' | 'missing' | 'invalid' | 'deployment-host';
}

export function canonicalUrlStatus(): CanonicalUrlStatus {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;
  const effective = canonicalSiteUrl();

  if (!raw) return { configured: null, effective, overridden: true, reason: 'missing' };

  const normalised = normalise(raw);
  if (!normalised) return { configured: raw, effective, overridden: true, reason: 'invalid' };

  const { hostname } = new URL(normalised);
  if (!isLocal(hostname) && isDeploymentHost(hostname)) {
    return { configured: raw, effective, overridden: true, reason: 'deployment-host' };
  }

  return { configured: raw, effective, overridden: false, reason: 'ok' };
}
