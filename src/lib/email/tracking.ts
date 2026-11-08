/**
 * ‏[1.44] מעקב צפייה בדואר — החלקים הטהורים (בלי I/O, ניתנים לבדיקה).
 *
 * כל הודעה יוצאת עם פיקסל שקוף ‎<img src=".../api/email/open/<id>.gif">‎.
 * כשלקוח הדואר טוען את התמונה, האתר רושם צפייה (‎record_email_open‎).
 *
 * מה המנגנון הזה *אינו* מודד, ולכן אסור להציג אותו כוודאות:
 *   • לקוח שחוסם תמונות (ברירת מחדל באאוטלוק, חלק מהג׳ימייל) — צפייה
 *     שלא נספרת. "לא נצפה" פירושו "לא נטענה תמונה", לא "לא נקרא".
 *   • ‎Apple Mail Privacy Protection‎ טוען את התמונה מראש, על שרתי
 *     אפל, גם כשהנמען לא פתח — צפייה שנספרת בלי שהייתה.
 *   • פרוקסי התמונות של ג׳ימייל שומר עותק: פתיחות חוזרות לא תמיד
 *     מגיעות אלינו, ולכן מספר הפתיחות הוא רף תחתון.
 */

const PIXEL_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isTrackingId(value: string): boolean {
  return PIXEL_PATTERN.test(value);
}

export function trackingPixelUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/api/email/open/${id}.gif`;
}

/** מוסיף את הפיקסל לסוף גוף ה-HTML (לפני ‎</body>‎ אם יש). */
export function injectTrackingPixel(html: string, url: string): string {
  const pixel = `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  const index = html.toLowerCase().lastIndexOf('</body>');
  return index === -1 ? html + pixel : html.slice(0, index) + pixel + html.slice(index);
}

/** ה-GIF השקוף, 1×1 — 43 בייט. */
export const TRANSPARENT_GIF = Uint8Array.from(
  atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'),
  (char) => char.charCodeAt(0),
);
