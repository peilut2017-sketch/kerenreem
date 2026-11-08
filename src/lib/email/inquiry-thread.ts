import { createHmac, timingSafeEqual } from 'node:crypto';
import { EMAIL_DOMAIN } from './addresses';

/**
 * ‏[1.43] מענה לפנייה ישירות מתיבת הדואר — החלקים הטהורים.
 *
 * ההתראה לצוות על פנייה חדשה יוצאת עם Reply-To אל כתובת שמזהה את
 * הפנייה: ‎contact+i<מזהה>.<חתימה>@kerenreem.org. כשאיש צוות לוחץ "השב",
 * Cloudflare Email Routing מעביר את התשובה ל-Email Worker, שמעביר אותה
 * ל-‎/api/email/inbound; שם היא נשלחת לפונה ונשמרת בשרשור הפנייה.
 *
 * החתימה היא ה-capability: מי שאין לו את הכתובת המלאה (והיא נחשפת רק
 * בהתראה שנשלחת לצוות) לא יכול להזריק "מענה" לפנייה, גם אם ניחש מזהה.
 * המודול הזה נטול server-only ו-I/O בכוונה, כדי שאפשר לבדוק אותו ישירות
 * (scripts/check-inquiry-thread.mjs).
 */

const SIGNATURE_LENGTH = 12;
const LOCAL_PART = 'contact';
const TAG_PATTERN = /^i([0-9a-f]{32})\.([0-9a-f]{12})$/;

/** הסוד המשותף בין האתר ל-Worker. ריק = התכונה כבויה. */
export function inboundSecret(): string | null {
  return process.env.INBOUND_EMAIL_SECRET?.trim() || null;
}

function sign(hexId: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`inquiry-reply:${hexId}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * כתובת המענה של פנייה, או null כשהתכונה כבויה (אין סוד) או שהמזהה
 * אינו UUID. null פירושו "השתמש בכתובת הפונה", כלומר ההתנהגות הקודמת.
 */
export function inquiryReplyAddress(
  inquiryId: string,
  secret: string | null = inboundSecret(),
): string | null {
  if (!secret || !UUID_PATTERN.test(inquiryId)) return null;
  const hexId = inquiryId.replaceAll('-', '').toLowerCase();
  return `${LOCAL_PART}+i${hexId}.${sign(hexId, secret)}@${EMAIL_DOMAIN}`;
}

function formatUuid(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** מזהה הפנייה מכתובת מענה חתומה, או null אם הכתובת אינה כזו / החתימה שגויה. */
export function parseInquiryReplyAddress(
  address: string,
  secret: string | null = inboundSecret(),
): string | null {
  if (!secret) return null;
  // ‏"שם <כתובת>" → כתובת
  const bare = (address.match(/<([^>]+)>/)?.[1] ?? address).trim().toLowerCase();
  const at = bare.lastIndexOf('@');
  if (at < 0 || bare.slice(at + 1) !== EMAIL_DOMAIN) return null;

  const local = bare.slice(0, at);
  const prefix = `${LOCAL_PART}+`;
  if (!local.startsWith(prefix)) return null;

  const match = TAG_PATTERN.exec(local.slice(prefix.length));
  if (!match) return null;

  const [, hexId, signature] = match;
  const expected = Buffer.from(sign(hexId, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return formatUuid(hexId);
}

/** השוואת מחרוזות בזמן קבוע — לאימות הסוד המשותף. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// תווי כיווניות שג'ימייל מוסיף סביב שורות בעברית; מפריעים להתאמת תבניות.
const BIDI_MARKS = /[‎‏‪-‮⁦-⁩]/g;

/** שורת הציטוט ש-Gmail / Outlook / Apple Mail מכניסים לפני ההודעה המצוטטת. */
const QUOTE_INTRO: RegExp[] = [
  /^on .{5,300}wrote:?$/i,
  /^on .{5,300}$/i, // השורה נשברת לפני ה-"wrote:" (בדיקה בנפרד בהמשך)
  /^בתאריך .{3,300}:$/,
  /^ב-?\s?\d.{3,200}(כתב|כתבה|כתב\/ה)\b.*$/,
  /^-{2,}\s*(original message|הודעה מקורית|forwarded message)/i,
  /^_{5,}$/,
];

/**
 * מסיר מגוף התשובה את ההודעה המצוטטת: משורת ההקדמה של הציטוט ("בתאריך …
 * כתב/ה:" / "On … wrote:") ומטה, וכל שורה שמתחילה ב-">". מה שנשאר הוא מה
 * שהצוות כתב בפועל. אם הכול הוסר (למשל תשובה שהיא ציטוט בלבד) מוחזר
 * טקסט ריק, והקורא דוחה אותה.
 */
export function stripQuotedReply(text: string): string {
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  const kept: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].replace(BIDI_MARKS, '').trim();

    if (line.startsWith('>')) break;

    const isIntro = QUOTE_INTRO.some((pattern, patternIndex) => {
      if (!pattern.test(line)) return false;
      if (patternIndex !== 1) return true;
      // "On …" בלי "wrote:" באותה שורה: רק אם השורה הבאה ממשיכה ב-wrote:
      return /^wrote:?$/i.test((lines[index + 1] ?? '').replace(BIDI_MARKS, '').trim());
    });
    if (isIntro) break;

    kept.push(lines[index]);
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function escapeText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** טקסט פשוט → HTML של פסקאות. הקורא עדיין מריץ sanitizeHtml לפני שמירה. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeText(paragraph).replaceAll('\n', '<br>')}</p>`)
    .join('');
}
