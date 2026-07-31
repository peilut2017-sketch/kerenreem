import NextImage, { type ImageProps } from 'next/image';
import { isOptimizableImageSrc } from '@/lib/image-src';

/**
 * next/image שאינו מפיל את העמוד על כתובת זרה.
 *
 * העטיפה היחידה שהרכיב מוסיף: unoptimized אוטומטי לכתובת שאינה מאחסון
 * הפרויקט. הדגל הזה גורם ל-generateImgAttrs לצאת מוקדם, לפני ה-loader
 * המובנה שזורק על כתובת שאינה ב-remotePatterns — וזו בדיוק הזריקה
 * שהפכה תמונה אחת שהודבקה בניהול לעמוד שגיאה שלם. ההסבר המלא ב-
 * src/lib/image-src.ts.
 *
 * בכל שאר המובנים זהו next/image רגיל: כתובות תקינות ממשיכות דרך שירות
 * האופטימיזציה בדיוק כמו קודם, עם אותו srcSet ואותו sizes.
 *
 * משמש בכל מקום שבו הכתובת מגיעה מהניהול. לנכסים סטטיים שמיובאים ב-import
 * אין צורך בו — שם הכתובת ידועה בזמן בנייה ואינה יכולה להיות זרה.
 */
export function Img(props: ImageProps) {
  // src יכול להיות גם StaticImageData (import סטטי); שם אין מה לבדוק.
  const unoptimized =
    props.unoptimized ?? (typeof props.src === 'string' ? !isOptimizableImageSrc(props.src) : false);

  return <NextImage {...props} unoptimized={unoptimized} />;
}
