/**
 * האם next/image רשאי לבקש אופטימיזציה לכתובת הזו.
 *
 * ה-loader המובנה של next/image **זורק שגיאה בזמן רינדור** כשהוא מקבל
 * כתובת שאינה תואמת ל-images.remotePatterns (ראו defaultLoader ב-
 * next/dist/shared/lib/image-loader.js). ברכיב שרת המשמעות היא שהעמוד
 * כולו נופל אל error.tsx — עמוד שגיאה שלם בגלל תמונה אחת.
 *
 * זה לא מקרה קצה: ImageField בממשק הניהול מזמין במפורש להדביק כתובת
 * ידנית ("או הדבקת כתובת ידנית"), ולכן עורך שמדביק קישור מגוגל או
 * מוואטסאפ מפיל בכך את עמוד האירוע או הספר. תמונה שבורה היא תקלה
 * קטנה; עמוד שנעלם היא תקלה גדולה, ואין סיבה שהראשונה תגרור את השנייה.
 *
 * הפונקציה משמשת את Img.tsx כדי לסמן unoptimized על כתובת זרה —
 * generateImgAttrs יוצא מוקדם כשהדגל דלוק ואינו מגיע ל-loader הזורק —
 * וגם את ImageField, כדי להזהיר את העורך כבר בזמן ההזנה.
 *
 * מה *לא* משתנה: /_next/image עדיין אוכף את remotePatterns בצד השרת,
 * ו-CSP עדיין מגביל את img-src לאחסון הפרויקט (ראו next.config.ts —
 * שני המקומות חייבים להישאר מסונכרנים עם SUPABASE_HOST/CDN_HOST כאן).
 * גבול האבטחה נשאר במקומו; כתובת זרה פשוט לא תוצג, במקום להפיל את העמוד.
 */

const SUPABASE_ORIGIN = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

const SUPABASE_HOST = (() => {
  if (!SUPABASE_ORIGIN) return null;
  return new URL(SUPABASE_ORIGIN).hostname;
})();

/**
 * מארחי אחסון מורשת — כתובות שנשמרו במסד לפני מעבר בין ספקי אחסון.
 *
 * הרקע: uploadToBucket שומר במסד כתובת *אבסולוטית* (תוצאת getPublicUrl).
 * במעבר מ-Supabase Cloud לאירוח עצמי (supabase.kerenreem.org) כל מה
 * שהועלה קודם ממשיך להצביע על <ref>.supabase.co — מארח שכבר אינו משרת
 * את הקבצים, ושה-CSP (בצדק) אינו מתיר. בלי תרגום, כל כריכה/גופן/PDF
 * ותיקים נשברים — לא בגלל שהקובץ חסר, אלא בגלל שהכתובת השמורה התיישנה.
 *
 * שני מקורות לרשימה:
 *  • כל תת-מתחם של supabase.co/supabase.in מזוהה אוטומטית: האתר עבר
 *    לאירוח עצמי, ולכן כל כתובת ענן כזו היא בהכרח שריד מלפני המעבר.
 *  • NEXT_PUBLIC_LEGACY_STORAGE_HOSTS — רשימה מופרדת בפסיקים למארחים
 *    נוספים (למשל דומיין CDN ישן שהוסב או פורק), ראו .env.example.
 *
 * כתובת מורשת מוכרת רק כשקיים בסיס נוכחי לתרגם אליה (SUPABASE_HOST או
 * CDN) — בסביבה לא מוגדרת אין לאן לתרגם, והכתובת נשארת "זרה" כמו קודם.
 */
const LEGACY_STORAGE_HOSTS: ReadonlySet<string> = new Set(
  (process.env.NEXT_PUBLIC_LEGACY_STORAGE_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
);

function isLegacyStorageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (LEGACY_STORAGE_HOSTS.has(host)) return true;
  return host.endsWith('.supabase.co') || host.endsWith('.supabase.in');
}

/**
 * האם הכתובת יושבת על מארח אחסון מורשת — בכל נתיב, לא רק תחת
 * ‎/storage/v1/object/public/‎. משמשת כשומר אחרון לפני fetch בצד שרת
 * (ראו storage-fetch.ts): כתובת שנשארה על מארח ישן גם אחרי toCdnUrl
 * (בסביבה בלי בסיס נוכחי, או נתיב שאינו אחסון ציבורי) לעולם אינה
 * נשלפת — עדיף קובץ חסר מפניית רשת למארח שכבר אינו קיים (ENOTFOUND).
 */
export function isLegacyStorageUrl(src: string): boolean {
  try {
    return isLegacyStorageHost(new URL(src).hostname);
  } catch {
    return false;
  }
}

/**
 * דומיין ה-CDN (Cloudflare) שמונח מול Supabase Storage — CNAME שמצביע
 * על SUPABASE_HOST, מופעל דרך הענן הכתום, להפחתת ה-Egress ממנה.
 * NEXT_PUBLIC_CDN_URL הוא רשות: בלעדיו כל הפונקציות כאן מתנהגות בדיוק
 * כמו לפני שהוא נוסף — כתובת האחסון המקורית של Supabase.
 */
const CDN_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_CDN_URL;
  if (!raw) return null;
  try {
    // origin ולא הערך הגולמי: ערך שאינו URL תקין (הודבק עם רווח, סוגריים
    // וכד') נפסל כאן פעם אחת — במקום להשבית בשקט את היישור ב-toCdnUrl.
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

const CDN_HOST = CDN_URL ? new URL(CDN_URL).hostname : null;

/** נתיב האחסון הציבורי — אותו דפוס בדיוק שמוגדר ב-next.config.ts. */
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

/**
 * כתובת מאחסון הפרויקט — ישירות מ-Supabase, דרך ה-CDN שמונח מולו, או
 * כתובת מורשת (מארח ישן) שנשמרה במסד לפני מעבר ספק — זו האחרונה מוכרת
 * רק כשיש בסיס נוכחי לתרגם אליה (toCdnUrl עושה זאת בכל נקודת הצגה).
 */
export function isProjectStorageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return false;
    if (url.hostname === SUPABASE_HOST || (CDN_HOST !== null && url.hostname === CDN_HOST)) return true;
    return (SUPABASE_ORIGIN !== null || CDN_URL !== null) && isLegacyStorageHost(url.hostname);
  } catch {
    return false;
  }
}

/**
 * נכס מקומי מתוך public/ (למשל /demo/cover.svg) או כתובת אחסון מוכרת.
 * כל השאר — כולל מחרוזת ריקה או כתובת שבורה — אינו בר-אופטימיזציה.
 */
export function isOptimizableImageSrc(src: string): boolean {
  if (src.startsWith('/') && !src.startsWith('//')) return true;
  return isProjectStorageUrl(src);
}

/**
 * מתרגמת כתובת אחסון של הפרויקט לבסיס ההגשה הנוכחי — רק ה-origin
 * (protocol+host) מוחלף, נתיב ה-bucket/קובץ נשאר זהה:
 *
 *  • כש-NEXT_PUBLIC_CDN_URL מוגדר — הכול מוגש דרך ה-CDN, כמו קודם.
 *  • בלעדיו — כתובת מורשת (מארח ישן, ראו LEGACY_STORAGE_HOSTS) מתורגמת
 *    ל-NEXT_PUBLIC_SUPABASE_URL הנוכחי; כתובת עדכנית חוזרת ללא שינוי.
 *
 * פונקציה אחת שמשמשת גם ב-uploadToBucket (על התוצאה הטרייה של
 * getPublicUrl, ברגע ההעלאה — כך שה-URL שנשמר במסד כבר מצביע על ה-CDN)
 * וגם בכל מקום שמציג כתובת שכבר שמורה במסד (Img, RichText/sanitize,
 * ורכיבי <img> ידניים שאינם עוברים דרך Img) — כך שתמונות שהועלו *לפני*
 * שה-CDN הוגדר, או לפני מעבר בין ספקי אחסון, מוצגות נכון בלי מיגרציית
 * מסד.
 *
 * כתובת שאינה מזוהה כאחסון הפרויקט (isProjectStorageUrl) חוזרת ללא
 * שינוי — כולל כתובת חיצונית שהודבקה ידנית בטופס ImageField.
 */
export function toCdnUrl(src: string): string {
  if (!isProjectStorageUrl(src)) return src;
  const targetBase = CDN_URL ?? SUPABASE_ORIGIN;
  if (!targetBase) return src;
  try {
    const url = new URL(src);
    const target = new URL(targetBase);
    if (url.origin === target.origin) return src;
    return `${target.origin}${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}
