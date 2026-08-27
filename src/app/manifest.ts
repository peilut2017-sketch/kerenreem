import type { MetadataRoute } from 'next';

/**
 * [1.37] Web App Manifest — כדי שהתקנת האתר כאפליקציה בנייד ("הוספה למסך
 * הבית") תקבל אייקון ושם אמיתיים במקום ברירת המחדל של הדפדפן (תמונת
 * מסך/אות ראשונה). האייקונים מוגשים דרך /app-icon (ראו שם) כדי לשקף
 * את הלוגו שהועלה ב-CMS בפועל, כמו /site-icon ללשונית הדפדפן.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'קרן רא״ם — הוצאה לאור תורה וחסד',
    short_name: 'קרן רא״ם',
    description: 'הוצאה לאור תורה וחסד',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf9f5',
    theme_color: '#6b1f26',
    icons: [
      { src: '/app-icon?size=192', sizes: '192x192', type: 'image/png' },
      { src: '/app-icon?size=512', sizes: '512x512', type: 'image/png' },
    ],
  };
}
