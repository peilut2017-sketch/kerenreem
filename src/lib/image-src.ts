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

/**
 * [1.7] דומיין CDN אופציונלי (Cloudflare) שמוצב לפני אחסון הפרויקט, כדי
 * לצמצם תעבורת Egress מ-Supabase: כשמוגדר NEXT_PUBLIC_CDN_URL, כל כתובת
 * אחסון ציבורית משוכתבת בזמן רינדור לדומיין הזה (ראו toMediaUrl). במסד
 * ממשיכה להישמר הכתובת הקנונית של Supabase — כך החלפת CDN עתידית היא
 * שינוי משתנה סביבה, לא עדכון של אלפי שורות (אותו עיקרון שכבר מתועד
 * ב-ImageField: "כך אפשר להחליף ספק אחסון בעתיד בלי לגעת בסכימה").
 * ה-CDN חייב להעביר את הנתיב כמו-שהוא לאותו נתיב ב-Supabase.
 */
const CDN_HOST = (() => {
  const url = process.env.NEXT_PUBLIC_CDN_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

/** נתיב האחסון הציבורי — אותו דפוס בדיוק שמוגדר ב-next.config.ts. */
const PUBLIC_STORAGE_PREFIX = '/storage/v1/object/public/';

/** כתובת מאחסון הפרויקט (ישירה או דרך ה-CDN) — היחידה שגם next/image וגם ה-CSP מתירים. */
export function isProjectStorageUrl(src: string): boolean {
  if (!SUPABASE_HOST) return false;
  try {
    const url = new URL(src);
    return (
      url.protocol === 'https:' &&
      (url.hostname === SUPABASE_HOST || (CDN_HOST !== null && url.hostname === CDN_HOST)) &&
      url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)
    );
  } catch {
    return false;
  }
}

/**
 * שכתוב כתובת מדיה לדומיין ה-CDN — נקודת המעבר המרכזית והיחידה.
 *
 * משכתב אך ורק כתובות אחסון *ציבוריות* של הפרויקט עצמו: קישורים חתומים
 * (bucket פרטי כמו contact-attachments) חייבים להישאר על הדומיין המקורי —
 * החתימה נבדקת שם; כתובות זרות נשארות כמות שהן. בלי NEXT_PUBLIC_CDN_URL
 * הפונקציה היא no-op מוחלט, כך שסביבת פיתוח ממשיכה לעבוד בלי שום הגדרה.
 */
export function toMediaUrl(src: string): string {
  if (!CDN_HOST || !SUPABASE_HOST) return src;
  try {
    const url = new URL(src);
    if (url.hostname !== SUPABASE_HOST || !url.pathname.startsWith(PUBLIC_STORAGE_PREFIX)) return src;
    url.hostname = CDN_HOST;
    return url.toString();
  } catch {
    return src;
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
