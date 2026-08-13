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

const SUPABASE_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

/**
 * דומיין ה-CDN (Cloudflare) שמונח מול Supabase Storage — CNAME שמצביע
 * על SUPABASE_HOST, מופעל דרך הענן הכתום, להפחתת ה-Egress ממנה.
 * NEXT_PUBLIC_CDN_URL הוא רשות: בלעדיו כל הפונקציות כאן מתנהגות בדיוק
 * כמו לפני שהוא נוסף — כתובת האחסון המקורית של Supabase.
 */
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL || null;

const CDN_HOST = (() => {
  if (!CDN_URL) return null;
  try {
    return new URL(CDN_URL).hostname;
  } catch {
    return null;
  }
})();

/** נתיב האחסון הציבורי — אותו דפוס בדיוק שמוגדר ב-next.config.ts. */
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

/** כתובת מאחסון הפרויקט — ישירות מ-Supabase, או כבר דרך ה-CDN שמונח מולו. */
export function isProjectStorageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return false;
    return url.hostname === SUPABASE_HOST || (CDN_HOST !== null && url.hostname === CDN_HOST);
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
 * ממירה כתובת אחסון של הפרויקט לכתובת דרך ה-CDN, אם NEXT_PUBLIC_CDN_URL
 * מוגדר — רק ה-origin (protocol+host) מוחלף, נתיב ה-bucket/קובץ נשאר
 * זהה. פונקציה אחת שמשמשת גם ב-uploadToBucket (על התוצאה הטרייה של
 * getPublicUrl, ברגע ההעלאה — כך שה-URL שנשמר במסד כבר מצביע על ה-CDN)
 * וגם בכל מקום שמציג כתובת שכבר שמורה במסד (Img, RichText/sanitize,
 * ורכיבי <img> ידניים שאינם עוברים דרך Img) — כך שתמונות שהועלו *לפני*
 * שה-CDN הוגדר גם הן מוצגות דרכו, בלי מיגרציית מסד.
 *
 * כתובת שאינה מזוהה כאחסון הפרויקט (isProjectStorageUrl) חוזרת ללא
 * שינוי — כולל כתובת חיצונית שהודבקה ידנית בטופס ImageField.
 */
export function toCdnUrl(src: string): string {
  if (!CDN_URL || !isProjectStorageUrl(src)) return src;
  try {
    const url = new URL(src);
    const cdn = new URL(CDN_URL);
    return `${cdn.origin}${url.pathname}${url.search}`;
  } catch {
    return src;
  }
}
