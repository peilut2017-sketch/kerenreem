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
 * ו-CSP עדיין מגביל את img-src לאחסון הפרויקט. גבול האבטחה נשאר במקומו;
 * כתובת זרה פשוט לא תוצג, במקום להפיל את העמוד.
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

/** נתיב האחסון הציבורי — אותו דפוס בדיוק שמוגדר ב-next.config.ts. */
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

/** כתובת מאחסון הפרויקט — היחידה שגם next/image וגם ה-CSP מתירים. */
export function isProjectStorageUrl(src: string): boolean {
  if (!SUPABASE_HOST) return false;
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      url.hostname === SUPABASE_HOST &&
      url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)
    );
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
