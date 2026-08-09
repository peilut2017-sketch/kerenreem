import NextImage, { type ImageProps } from 'next/image';
import { isOptimizableImageSrc, toMediaUrl } from '@/lib/image-src';

/**
 * next/image שאינו מפיל את העמוד על כתובת זרה.
 *
 * העטיפה מוסיפה שני דברים:
 * 1. unoptimized אוטומטי לכתובת שאינה מאחסון הפרויקט. הדגל הזה גורם
 *    ל-generateImgAttrs לצאת מוקדם, לפני ה-loader המובנה שזורק על כתובת
 *    שאינה ב-remotePatterns — וזו בדיוק הזריקה שהפכה תמונה אחת שהודבקה
 *    בניהול לעמוד שגיאה שלם. ההסבר המלא ב-src/lib/image-src.ts.
 * 2. [1.7] ניתוב אוטומטי דרך ה-CDN (toMediaUrl) — נקודת מעבר יחידה לכל
 *    התמונות באתר. כתובת אחסון ציבורית משוכתבת לדומיין ה-CDN אם מוגדר,
 *    אחרת נשארת כמות שהיא. כך אין צורך לגעת בכל אחד מעשרות מוקדי התמונה.
 *
 * בכל שאר המובנים זהו next/image רגיל: כתובות תקינות ממשיכות דרך שירות
 * האופטימיזציה בדיוק כמו קודם, עם אותו srcSet ואותו sizes.
 *
 * משמש בכל מקום שבו הכתובת מגיעה מהניהול. לנכסים סטטיים שמיובאים ב-import
 * אין צורך בו — שם הכתובת ידועה בזמן בנייה ואינה יכולה להיות זרה.
 */
export function Img(props: ImageProps) {
  // src יכול להיות גם StaticImageData (import סטטי); שם אין מה לשכתב/לבדוק.
  const src = typeof props.src === 'string' ? toMediaUrl(props.src) : props.src;
  const unoptimized =
    props.unoptimized ?? (typeof src === 'string' ? !isOptimizableImageSrc(src) : false);

  return <NextImage {...props} src={src} unoptimized={unoptimized} />;
}
