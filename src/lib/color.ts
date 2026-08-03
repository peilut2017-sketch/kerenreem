/**
 * חשבון צבע טהור — בלי תלות בשרת, בקבצים או ב-sharp, כדי שיהיה אפשר
 * לבדוק אותו ישירות (ראו scripts/check-cover-colors.mjs). cover-colors.ts
 * הוא שעוטף את זה בקריאת הקובץ ובחילוץ הפיקסלים.
 */

export type RGB = [number, number, number];

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

export function hslToRgb([h, s, l]: [number, number, number]): RGB {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/**
 * מביא צבע שנדלה מהכריכה לטווח שבו הוא עדיין *נראה* אחרי שנמרח על הרקע
 * בשקיפות נמוכה.
 *
 * בלי זה הרעיון של "רקע נגזר מהכריכה" פשוט אינו עובד, וזה נמדד: כריכה
 * כהה (נייבי 20,30,44) מחזירה שלושה אשכולות כהים כמעט זהים, ובשקיפות
 * ~30% מעל קרם שלושתם קורסים לאותו אפור בוצי — כלומר כל ספר כהה קיבל
 * בדיוק את אותו Hero, ההפך הגמור מ"כל ספר מרגיש אחר".
 *
 * הגוון (hue) נשמר כפי שהוא — הוא הזהות של הכריכה. רק הרוויה והבהירות
 * נדחפות לטווח שבו הגוון שורד את המיהול.
 */
export function toTint(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  // כריכה כמעט חסרת צבע (שחור/לבן/אפור) לא תיאלץ לגוון מומצא
  const saturation = s < 0.06 ? s : Math.min(0.62, Math.max(0.34, s));
  const lightness = Math.min(0.68, Math.max(0.46, l));
  return hslToRgb([h, saturation, lightness]);
}

/**
 * אותו גוון, בטווח של שדרת ספר: עמוק ורווי, לא מולבן.
 *
 * ההפך מ-toTint. שם הצבע נמרח על רקע בשקיפות ולכן חייב להיות בהיר;
 * כאן הוא הצבע המלא של גוף השדרה, ולכן דווקא כהה — וגם כדי שכיתוב
 * הזהב שעליו יעמוד ביחס ניגודיות תקין תמיד, בלי לבדוק כל כריכה בנפרד.
 * החסם העליון על הבהירות (0.34) הוא מה שמבטיח את זה.
 */
export function toSpine(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  const saturation = s < 0.06 ? s : Math.min(0.7, Math.max(0.22, s));
  const lightness = Math.min(0.34, Math.max(0.14, l));
  return hslToRgb([h, saturation, lightness]);
}
