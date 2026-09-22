import 'server-only';

import { getSiteSettings } from '@/lib/data';
import { toCdnUrl } from '@/lib/image-src';

/**
 * [1.40] המעטפת המותגת לכל דואר יוצא מהאתר.
 *
 * למה תבניות HTML ידניות ולא ספריית רינדור: דואר אינו דפדפן. Gmail
 * מסיר <style> חיצוני ברוב המקרים, Outlook מרנדר ב-Word, ו-flexbox/grid
 * פשוט אינם נתמכים. מה שעובד בכל הלקוחות הוא אותו דבר שעבד תמיד —
 * טבלאות, רוחבים קבועים, וסגנון inline על כל אלמנט. לכן כאן אין שום
 * הפשטה חכמה: פונקציות שמחזירות מחרוזות HTML שמרניות.
 *
 * מה כן יש: מקור אמת אחד לצבעים, ללוגו ולכותרת התחתונה, כך שכל
 * ההודעות — אישור הזמנה, איפוס סיסמה, מענה לפנייה — נראות כמו שנשלחו
 * מאותו גוף. עד עכשיו כל מודול הרכיב HTML משלו בלי לוגו ובלי זהות.
 *
 * הלוגו מגיע מהגדרות האתר (site_settings.logo_url) — אותו קובץ שמוצג
 * בכותרת. כשאין לוגו מוצג שם המכון כטקסט בגופן serif: תמונה שבורה
 * בראש מייל גרועה מהיעדר תמונה.
 */

/** צבעי הזהות, בערכים מפורשים. משתני CSS אינם נתמכים בדואר. */
const BRAND = {
  navy: '#0b1520',
  navySoft: '#14243a',
  gold: '#c8a868',
  goldDeep: '#8a6820',
  burgundy: '#6b1f26',
  cream: '#faf7f0',
  cream2: '#f3ede0',
  rule: '#e2d9c6',
  ink: '#1f1c17',
  inkSoft: '#3d382f',
  muted: '#8a8577',
} as const;

const FONT_STACK = "'Segoe UI', Arial, Helvetica, sans-serif";
const SERIF_STACK = "Georgia, 'Times New Roman', serif";

export interface EmailBrand {
  siteName: string;
  siteUrl: string;
  logoUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

/**
 * פרטי המותג מהגדרות האתר. כשל בשליפה אינו מפיל שליחת דואר — נופלים
 * לערכי ברירת מחדל, כי מייל בלי לוגו עדיף על מייל שלא נשלח.
 */
export async function getEmailBrand(): Promise<EmailBrand> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
  try {
    const settings = await getSiteSettings();
    return {
      siteName: 'מכון קרן רא״ם',
      siteUrl,
      logoUrl: settings.logo_url ? toCdnUrl(settings.logo_url) : null,
      contactEmail: settings.contact?.email ?? null,
      contactPhone: settings.contact?.phone ?? null,
      address: settings.contact?.address_he ?? null,
    };
  } catch (error) {
    console.error('[email:brand]', error);
    return {
      siteName: 'מכון קרן רא״ם',
      siteUrl,
      logoUrl: null,
      contactEmail: null,
      contactPhone: null,
      address: null,
    };
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * רק http(s) נכנס ל-href. הערכים מגיעים מטפסים ומהגדרות, ובלי הבדיקה
 * ‎javascript: או מחרוזת שסוגרת את התג הייתה יוצאת החוצה חתומה ב-DKIM
 * של המכון.
 */
export function safeUrl(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : null;
}

/* ------------------------------- בלוקים ---------------------------------- */

/** פסקה רגילה. */
export function p(html: string, options: { muted?: boolean; small?: boolean } = {}): string {
  const size = options.small ? '13px' : '15px';
  const color = options.muted ? BRAND.muted : BRAND.inkSoft;
  return `<p style="margin:0 0 14px;font-family:${FONT_STACK};font-size:${size};line-height:1.75;color:${color}">${html}</p>`;
}

/** כותרת משנה בתוך גוף ההודעה. */
export function h(text: string): string {
  return `<h2 style="margin:26px 0 12px;font-family:${SERIF_STACK};font-size:19px;line-height:1.35;color:${BRAND.ink};font-weight:normal">${escapeHtml(text)}</h2>`;
}

/**
 * כפתור פעולה. נבנה כטבלה ולא כ-<a> מעוצב: Outlook מתעלם מ-padding על
 * קישור, והכפתור היה מתכווץ לטקסט מקושר רגיל.
 */
export function button(label: string, url: string): string {
  const href = safeUrl(url);
  if (!href) return '';
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0">
    <tr>
      <td align="center" bgcolor="${BRAND.navy}" style="border-radius:999px">
        <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 30px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** קו מפריד עדין. */
export function divider(): string {
  return `<div style="height:1px;background:${BRAND.rule};margin:24px 0"></div>`;
}

/**
 * טבלת "שם: ערך" — לפרטי פנייה, לפרטי הזמנה. שתי עמודות, בלי גבולות:
 * רשימה מיושרת נקראת מהר יותר מפסקאות של "השדה X הוא Y".
 */
export function definitionTable(rows: { label: string; value: string }[]): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      (row) => `
      <tr>
        <td style="padding:7px 0;vertical-align:top;width:34%;font-family:${FONT_STACK};font-size:13px;color:${BRAND.muted}">${escapeHtml(row.label)}</td>
        <td style="padding:7px 0;vertical-align:top;font-family:${FONT_STACK};font-size:14px;color:${BRAND.ink}">${row.value}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:6px 0 18px;border-top:1px solid ${BRAND.rule};border-bottom:1px solid ${BRAND.rule}">${body}</table>`;
}

/** מסגרת ציטוט — לתוכן שהמשתמש עצמו כתב, כדי שלא ייקרא כאילו נכתב על ידינו. */
export function quoteBlock(html: string): string {
  return `<div style="margin:0 0 18px;padding:14px 18px;background:${BRAND.cream2};border-inline-start:3px solid ${BRAND.gold};font-family:${FONT_STACK};font-size:14px;line-height:1.7;color:${BRAND.inkSoft}">${html}</div>`;
}

/** הערת אזהרה/ביטחון — רקע חם ובולט מעט, לא אדום מבהיל. */
export function noticeBlock(text: string): string {
  return `<div style="margin:0 0 18px;padding:12px 16px;background:#fffbeb;border:1px solid #f0e0b8;border-radius:8px;font-family:${FONT_STACK};font-size:13px;line-height:1.65;color:${BRAND.goldDeep}">${escapeHtml(text)}</div>`;
}

/* ------------------------------- המעטפת ---------------------------------- */

export interface RenderedEmail {
  subject: string;
  html: string;
  /** גרסת טקסט — לקוחות שחוסמים HTML, ולמסנני דואר זבל שמורידים ציון בלעדיה. */
  text: string;
}

/**
 * עוטף גוף הודעה במעטפת המותגת: לוגו, כותרת, תוכן, וכותרת תחתונה עם
 * פרטי המכון.
 *
 * ‎preheader הוא הטקסט שלקוחות דואר מציגים בתיבת הדואר אחרי הנושא.
 * בלעדיו הם שואבים את המילים הראשונות מה-HTML — לרוב "צפייה בדפדפן"
 * או alt של הלוגו. מוסתר בגוף ההודעה בשלוש דרכים במקביל, כי כל לקוח
 * מכבד אחרת.
 */
export function renderBrandedEmail({
  brand,
  subject,
  preheader,
  title,
  body,
  text,
}: {
  brand: EmailBrand;
  subject: string;
  preheader: string;
  /** כותרת גדולה בראש ההודעה. ריק — אין כותרת, הגוף מתחיל ישר. */
  title?: string;
  /** גוף ההודעה כ-HTML, מורכב מהבלוקים שלמעלה. */
  body: string;
  /** גוף ההודעה כטקסט נקי. */
  text: string;
}): RenderedEmail {
  const home = safeUrl(brand.siteUrl) ?? '';
  const logo = safeUrl(brand.logoUrl);

  const header = logo
    ? `<a href="${escapeHtml(home)}" style="text-decoration:none"><img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.siteName)}" height="56" style="display:block;margin:0 auto;height:56px;width:auto;border:0"></a>`
    : `<a href="${escapeHtml(home)}" style="display:block;text-align:center;font-family:${SERIF_STACK};font-size:22px;color:${BRAND.gold};text-decoration:none">${escapeHtml(brand.siteName)}</a>`;

  const footerLines = [
    brand.address ? escapeHtml(brand.address) : null,
    brand.contactPhone ? `טלפון: ${escapeHtml(brand.contactPhone)}` : null,
    brand.contactEmail
      ? `<a href="mailto:${escapeHtml(brand.contactEmail)}" style="color:${BRAND.muted}">${escapeHtml(brand.contactEmail)}</a>`
      : null,
  ].filter(Boolean);

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
  <div style="display:none;font-size:1px;color:${BRAND.cream};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${BRAND.cream}">
    <tr>
      <td align="center" style="padding:28px 14px">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%">
          <!-- רצועת הזהות: רקע כהה בגווני הלוגו, כמו רצועות ה-on-dark באתר -->
          <tr>
            <td align="center" bgcolor="${BRAND.navy}" style="padding:26px 24px;border-radius:16px 16px 0 0">
              ${header}
            </td>
          </tr>
          <!-- קו הזהב שמפריד בין הרצועה לגוף, כמו קרש המדף באתר -->
          <tr>
            <td style="height:3px;background:${BRAND.gold};font-size:0;line-height:0">&nbsp;</td>
          </tr>

          <tr>
            <td dir="rtl" align="right" bgcolor="#ffffff" style="padding:30px 32px 24px;border-inline:1px solid ${BRAND.rule}">
              ${title ? `<h1 style="margin:0 0 18px;font-family:${SERIF_STACK};font-size:24px;line-height:1.3;color:${BRAND.ink};font-weight:normal">${escapeHtml(title)}</h1>` : ''}
              ${body}
            </td>
          </tr>

          <tr>
            <td dir="rtl" align="center" bgcolor="${BRAND.cream2}" style="padding:20px 28px;border:1px solid ${BRAND.rule};border-top:0;border-radius:0 0 16px 16px">
              <p style="margin:0 0 6px;font-family:${SERIF_STACK};font-size:15px;color:${BRAND.ink}">${escapeHtml(brand.siteName)}</p>
              ${footerLines
                .map(
                  (line) =>
                    `<p style="margin:0 0 3px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted}">${line}</p>`,
                )
                .join('')}
              ${
                home
                  ? `<p style="margin:10px 0 0;font-family:${FONT_STACK};font-size:12px"><a href="${escapeHtml(home)}" style="color:${BRAND.goldDeep};text-decoration:none">${escapeHtml(home.replace(/^https?:\/\//, ''))}</a></p>`
                  : ''
              }
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const footerText = [
    brand.siteName,
    brand.address,
    brand.contactPhone ? `טלפון: ${brand.contactPhone}` : null,
    brand.contactEmail,
    home || null,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    html,
    text: `${title ? `${title}\n\n` : ''}${text}\n\n—\n${footerText}`,
  };
}
