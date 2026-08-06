import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizePhone } from './phone';

/**
 * קישור הזמנת האורח (פרק 4.2 במסמך האב): טוקן אקראי 256 ביט שנשלח
 * במייל בלבד; במסד נשמר sha256 שלו. ניחוש בלתי מעשי, דליפת מסד אינה
 * דליפת קישורים, וביטול = דגל על ההזמנה.
 */

export function generateGuestToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashGuestToken(token) };
}

export function hashGuestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** השוואה בזמן קבוע — לא משווים מחרוזות טוקן ב-===. */
export function guestTokenMatches(token: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashGuestToken(token), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/**
 * [1.1] גיבוב טלפון מנורמל — HMAC-SHA256 עם סוד שרת (סעיף 6 בסבב
 * התיקונים): מרחב מספרי הטלפון קטן מספיק להיפוך sha256 רגיל בכוח גס.
 * הסוד: COMMERCE_HMAC_SECRET; בהיעדרו — נגזרת מ-service role key (קיים
 * תמיד בסביבת שרת אמיתית) כדי שהאתר לא ייפול, עם אזהרה בלוג.
 */
export function hashContact(phone: string): string {
  const secret = process.env.COMMERCE_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    console.warn('[commerce] COMMERCE_HMAC_SECRET חסר — hash טלפון ללא סוד ייעודי');
    return createHash('sha256').update(normalizePhone(phone)).digest('hex');
  }
  return createHmac('sha256', secret).update(normalizePhone(phone)).digest('hex');
}

/**
 * ה-hash מהדור הקודם (sha256 חשוף) — להשוואה כפולה בקריאה בלבד, לתקופת
 * המעבר של רשומות coupon_redemptions שנכתבו לפני 1.1. אין לכתוב איתו.
 */
export function legacyHashContact(phone: string): string {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex');
}

export { normalizePhone, isValidIsraeliPhone } from './phone';
