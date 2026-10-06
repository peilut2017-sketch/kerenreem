/**
 * סיווג בקשות אנליטיקה — פונקציות טהורות בלבד (בלי גישה למסד/כותרות), כדי
 * שאפשר לבדוק אותן בסקריפט (scripts/check-analytics.mjs) ולשתף אותן בין
 * נתיב האיסוף לדוחות.
 */

export type Channel = 'direct' | 'organic_search' | 'social' | 'email' | 'referral' | 'paid' | 'campaign';
export type Device = 'mobile' | 'tablet' | 'desktop';

const SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|baidu|ask|brave|startpage|walla|nana10)\./i;
const SOCIAL_HOSTS =
  /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|t\.co|twitter\.com|x\.com|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|tiktok\.com|whatsapp\.com|wa\.me|telegram\.org|t\.me|pinterest\.com|reddit\.com)$/i;
const MAIL_HOSTS = /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com|walla\.co\.il)$/i;
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsearch|paid-search|display|banner|cpm)$/i;
const EMAIL_MEDIUM = /^(email|e-mail|newsletter|mail)$/i;
const SOCIAL_MEDIUM = /^(social|social-media|sm)$/i;

const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget|python-requests|axios|node-fetch|go-http|java\/|okhttp|preview|prerender|phantomjs|puppeteer|playwright|chrome-lighthouse|gtmetrix|semrush|ahrefs|mj12|dataprovider|petalbot|bytespider/i;

/** שם מתחם נקי: אותיות קטנות, בלי www, בלי פורט. null כשאינו תקין. */
export function normalizeHost(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const host = value.trim().toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
  if (host.length < 3 || host.length > 100 || !/^[a-z0-9.à-￿-]+$/i.test(host) || !host.includes('.')) {
    return null;
  }
  return host;
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent === 'unknown') return true;
  return BOT_UA.test(userAgent);
}

export function deviceFromUserAgent(userAgent: string | null | undefined): Device {
  const ua = userAgent ?? '';
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return 'tablet';
  if (/mobi|iphone|ipod|android|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/** מחרוזת קצרה ובטוחה לשמירה (utm_*): עד 80 תווים, בלי תווי בקרה. */
export function cleanLabel(value: unknown, max = 80): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  return cleaned || null;
}

export function countryFromHeaders(headers: Headers): string | null {
  const raw = headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry');
  return raw && /^[A-Za-z]{2}$/.test(raw) && raw.toUpperCase() !== 'XX' ? raw.toUpperCase() : null;
}

/**
 * ערוץ הגעה לפי UTM ואז לפי המפנה. מפנה מאותו אתר אינו מגיע לכאן בכלל
 * (הלקוח אינו שולח אותו, והשרת מסנן שוב) — כניסה בלי מפנה היא ישירה.
 */
export function classifyChannel(input: {
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
}): Channel {
  const { referrerHost, utmSource, utmMedium } = input;
  if (utmMedium) {
    if (PAID_MEDIUM.test(utmMedium)) return 'paid';
    if (EMAIL_MEDIUM.test(utmMedium)) return 'email';
    if (SOCIAL_MEDIUM.test(utmMedium)) return 'social';
  }
  if (utmSource || utmMedium) return 'campaign';
  if (!referrerHost) return 'direct';
  if (MAIL_HOSTS.test(referrerHost)) return 'email';
  if (SEARCH_ENGINES.test(referrerHost)) return 'organic_search';
  if (SOCIAL_HOSTS.test(referrerHost)) return 'social';
  return 'referral';
}

/** נתיב נקי לשמירה: מפוענח, בלי query/hash, ללא קידומות שאינן עמוד ציבורי. */
export function cleanPath(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 300) return null;
  let path = value.split('?')[0].split('#')[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    /* נשאר מקודד — עדיף מאשר לאבד את הצפייה */
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (/^\/(admin|api|_next)(\/|$)/.test(path)) return null;
  return path || '/';
}
