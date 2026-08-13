import NextImage, { type ImageProps } from 'next/image';
import { isOptimizableImageSrc, toCdnUrl } from '@/lib/image-src';

/**
 * next/image שאינו מפיל את העמוד על כתובת זרה, ומגיש כתובות אחסון
 * דרך ה-CDN (Cloudflare) שמונח מול Supabase Storage, אם הוגדר —
 * ראו src/lib/image-src.ts (toCdnUrl).
 *
 * העטיפה היחידה שהרכיב מוסיף מעבר לזה: unoptimized אוטומטי לכתובת
 * שאינה מאחסון הפרויקט. הדגל הזה גורם ל-generateImgAttrs לצאת מוקדם,
 * לפני ה-loader המובנה שזורק על כתובת שאינה ב-remotePatterns — וזו
 * בדיוק הזריקה שהפכה תמונה אחת שהודבקה בניהול לעמוד שגיאה שלם. ההסבר
 * המלא ב-src/lib/image-src.ts.
 *
 * בכל שאר המובנים זהו next/image רגיל: כתובות תקינות ממשיכות דרך שירות
 * האופטימיזציה בדיוק כמו קודם, עם אותו srcSet ואותו sizes. הבדיקה
 * (isOptimizableImageSrc) פועלת על הכתובת *המקורית* שנשמרה במסד, לפני
 * ההמרה ל-CDN — כך ש-remotePatterns/CSP נשארים מקור האמת היחיד, בלי
 * תלות בסדר הפעולות.
 *
 * משמש בכל מקום שבו הכתובת מגיעה מהניהול. לנכסים סטטיים שמיובאים ב-import
 * אין צורך בו — שם הכתובת ידועה בזמן בנייה ואינה יכולה להיות זרה.
 */
export function Img({ src, ...props }: ImageProps) {
  // src יכול להיות גם StaticImageData (import סטטי); שם אין מה לבדוק/להמיר.
  const rawSrc = typeof src === 'string' ? src : undefined;
  const unoptimized = props.unoptimized ?? (rawSrc ? !isOptimizableImageSrc(rawSrc) : false);
  const resolvedSrc = rawSrc ? toCdnUrl(rawSrc) : src;

  return <NextImage src={resolvedSrc} unoptimized={unoptimized} {...props} />;
}
