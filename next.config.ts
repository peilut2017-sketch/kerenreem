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
  `script-src 'self' 'unsafe-inline'${GA_SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob:${supabaseHost ? ` https://${supabaseHost}` : ''} https://i.ytimg.com${GA_IMG_SRC}`,
  `connect-src 'self'${supabaseHost ? ` https://${supabaseHost} wss://${supabaseHost}` : ''}${GA_CONNECT_SRC}`,
  "frame-src https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
