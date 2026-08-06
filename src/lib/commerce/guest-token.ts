import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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

/** גיבוב טלפון מנורמל — לאכיפת מגבלות קופון לאורחים בלי לשמור את המספר. */
export function hashContact(phone: string): string {
  return createHash('sha256').update(normalizePhone(phone)).digest('hex');
}

export { normalizePhone, isValidIsraeliPhone } from './phone';
