/**
 * נירמול ואימות טלפון ישראלי — טהור, ללא תלות שרת (נבדק ב-check-commerce).
 * הצורה האחידה במסד ובתקשורת: E.164 (‎+972…).
 */

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('972')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return `+972${digits}`;
}

export function isValidIsraeliPhone(raw: string): boolean {
  // ‎[2-489]‎ — קידומות קו: 2, 3, 4, 8, 9. בלי פסיק בתוך המחלקה: פסיק
  // במחלקת תווים הוא תו מילולי, לא מפריד טווחים.
  return /^\+9725\d{8}$|^\+972[2-489]\d{7}$|^\+97277\d{7}$/.test(normalizePhone(raw));
}
