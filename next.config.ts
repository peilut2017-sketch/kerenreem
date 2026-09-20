import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * תמונות מגיעות מ-Supabase Storage. הדומיין נגזר מכתובת הפרויקט כדי שלא
 * נצטרך לתחזק רשימה כפולה בקוד ובסביבה.
 */
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

/**
 * דומיין ה-CDN (Cloudflare) שמונח מול Supabase Storage, אם הוגדר —
 * ראו src/lib/image-src.ts (toCdnUrl) לפרטים. supabaseHost נשאר מותר
 * גם כשה-CDN מוגדר: כתובות שנשמרו במסד *לפני* המעבר עדיין מצביעות
 * עליו ישירות, ואסור שהן ייחסמו.
 */
const cdnHost = (() => {
  const url = process.env.NEXT_PUBLIC_CDN_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

/**
 * Google Analytics 4 מוגדר-תצורה: מופעל רק כש-NEXT_PUBLIC_GA_MEASUREMENT_ID
 * קיים (ראו src/components/GoogleAnalytics.tsx). ה-CSP מורחב לספקי גוגל
 * *רק* כשהמשתנה מוגדר בזמן הבנייה — אתר שלא הגדיר GA4 ממשיך לקבל את
 * ה-CSP המחמיר המקורי בלי אף מתחם חיצוני נוסף.
 */
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
const GA_SCRIPT_SRC = gaEnabled ? ' https://www.googletagmanager.com' : '';
const GA_CONNECT_SRC = gaEnabled
  ? ' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com'
  : '';
const GA_IMG_SRC = gaEnabled ? ' https://www.google-analytics.com https://*.google-analytics.com' : '';

/**
 * reCAPTCHA v2 בטופס יצירת הקשר — מוגדר-תצורה באותו דפוס כמו GA4 למעלה:
 * מורחב רק כש-NEXT_PUBLIC_RECAPTCHA_SITE_KEY קיים בזמן הבנייה (ראו
 * src/components/Captcha.tsx). אתר שלא הגדיר קאפצ'ה ממשיך לקבל את
 * ה-CSP המחמיר המקורי בלי אף מתחם חיצוני נוסף.
 */
const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY);
const CAPTCHA_SCRIPT_SRC = captchaEnabled ? ' https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/' : '';
const CAPTCHA_FRAME_SRC = captchaEnabled ? ' https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/' : '';

/**
 * כותרות אבטחה.
 *
 * ה-CSP מתיר `unsafe-inline` לסקריפטים משום ש-Next מזריק סקריפטים מוטבעים
 * (hydration, וסקריפט הנגישות שרץ לפני הצביעה). הידוק ל-nonce דורש הזרקת
 * nonce ב-proxy ובכל תגית script — שדרוג ראוי, אך לא תנאי לעלייה לאוויר.
 * frame-src מוגבל למקורות הווידאו המאושרים, באותה רשימה שבה משתמש
 * ה-sanitizer (src/lib/sanitize.ts) — שני המקומות חייבים להישאר מסונכרנים.
 *
 * האנליטיקס העצמאי (page_views) אינו מופיע כאן: הוא נשלח כ-Server Action
 * לאותו מקור (same-origin), ולא דרך fetch/script בצד הלקוח — 'self' כבר
 * מכסה אותו במלואו, בלי שום הרחבה.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${GA_SCRIPT_SRC}${CAPTCHA_SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  // [1.11] גופנים מותקנים (custom_fonts) מוגשים מאחסון הפרויקט/CDN —
  // הגופנים המובנים נשארים self (next/font מארח אותם מקומית).
  `font-src 'self' data:${supabaseHost ? ` https://${supabaseHost}` : ''}${cdnHost ? ` https://${cdnHost}` : ''}`,
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''}${cdnHost ? ` https://${cdnHost}` : ''} https://i.ytimg.com${GA_IMG_SRC}`,
  // cdnHost גם ב-connect-src: דפדוף ה-PDF לדוגמה (pdf.js) מושך את הקובץ
  // ב-fetch, וכתובות אחסון מיושרות ל-CDN בכל נקודת הצגה (toCdnUrl) —
  // בלי ההיתר הזה ה-fetch נחסם בדיוק כשה-CDN מוגדר.
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}${cdnHost ? ` https://${cdnHost}` : ''}${GA_CONNECT_SRC}`,
  `frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com${CAPTCHA_FRAME_SRC}`,
  'upgrade-insecure-requests',
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

/**
 * [1.5] גביית אשראי בהזמנה טלפונית (CardPaymentDrawer): טוענת את טופס
 * התשלום המאובטח של מורנינג בתוך iframe בעמוד ההזמנה, ומורנינג מפנה
 * בסיום חזרה לעמוד payment-return שלנו — גם הוא בתוך אותו iframe. שני
 * הכיוונים חסומים כברירת מחדל ב-CSP הגלובלי (frame-src מוגבל לוידאו
 * בלבד; frame-ancestors 'none' חוסם הטמעה של כל עמוד שלנו) — לכן שתי
 * דריסות ממוקדות, לא שינוי המדיניות הגלובלית:
 *  - frame-src מורחב ל-domains של מורנינג, רק תחת /admin/orders/*.
 *  - frame-ancestors/X-Frame-Options מוקלים ל-'self', רק בנתיב
 *    payment-return המדויק — שאר הניהול (כולל עמוד ההזמנה עצמו, עם
 *    כפתורי ביטול/מחיקה/זיכוי) נשאר חסום-הטמעה לגמרי, כהגנה מ-clickjacking.
 *
 * ⚠️ ה-domain המדויק שמורנינג מחזירה בשדה url של POST /payments/form לא
 * אומת מול Sandbox בפועל (התיעוד הרשמי חסום מהסביבה שבה נכתב הקוד) —
 * הרשימה למטה היא ההנחה הסבירה ביותר (API hosts הידועים + wildcard
 * ברמה אחת). אם ה-iframe לא נטען בפועל, לבדוק את השגיאה שחסמה אותו
 * ב-console (CSP violation) ולהוסיף את ה-host המדויק לכאן.
 */
const MORNING_FRAME_SRC =
  'https://sandbox.d.greeninvoice.co.il https://api.greeninvoice.co.il https://*.greeninvoice.co.il';
const ORDERS_CSP = CSP.replace(
  'frame-src https://www.youtube-nocookie.com',
  `frame-src ${MORNING_FRAME_SRC} https://www.youtube-nocookie.com`,
);
const PAYMENT_RETURN_CSP = CSP.replace("frame-ancestors 'none'", "frame-ancestors 'self'");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['sharp'],
  /**
   * sharp ב-Vercel: ה-tracer של ה-build (NFT) עוקב אחרי require ב-JS,
   * ולכן אורז את המודול הנייטיבי sharp-linux-x64-*.node — אבל *לא* את
   * libvips-cpp.so.* שהמודול טוען ב-dlopen (תלות ELF, לא require, ראו
   * RUNPATH של קובץ ה-node). התוצאה בפרודקשן: ERR_DLOPEN_FAILED,
   * "libvips-cpp.so.8.18.6: cannot open shared object file" — עמוד 500
   * בכל מסלול שנוגע ב-sharp (צבעי כריכה בעמוד ספר ובמדף, /app-icon).
   * ההכללה המפורשת כאן מכריחה את האריזה של ספריות libvips ל-functions.
   * שני מפתחות — גלוב רחב וגם המסלול הנייטיבי המרכזי — כי מפתח שאינו
   * תואם מדולג בשקט, וכפילות היא no-op.
   */
  outputFileTracingIncludes: {
    '/**': ['./node_modules/@img/sharp-libvips-linux-x64/**/*'],
    '/app-icon': ['./node_modules/@img/sharp-libvips-linux-x64/**/*'],
  },
  images: {
    // Next 16 מקבל רק איכויות שברשימה (ברירת מחדל: [75]) ומחזיר 400 לכל
    // ערך אחר — ו-BookShelf/Spine מבקשים quality={90} לכריכות ולשדרות.
    // בלי השורה הזו מדף עמוד הבית ומדף הסדרה נשברים בשקט בפרודקשן.
    qualities: [75, 90],
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
        : []),
      ...(cdnHost
        ? [{ protocol: 'https' as const, hostname: cdnHost, pathname: '/storage/v1/object/public/**' }]
        : []),
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      { source: '/admin/orders/:path*', headers: [{ key: 'Content-Security-Policy', value: ORDERS_CSP }] },
      {
        source: '/admin/orders/:id/payment-return',
        headers: [
          { key: 'Content-Security-Policy', value: PAYMENT_RETURN_CSP },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
