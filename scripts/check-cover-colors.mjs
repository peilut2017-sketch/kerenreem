/**
 * בדיקת נרמול צבעי הכריכה.
 *
 * הבדיקה שמונעת חזרה לבאג שנמדד בפועל: כריכות כהות שונות (נייבי,
 * בורגונדי, ירוק) קיבלו רקע Hero זהה — אפור בוצי — כי הצבעים הגולמיים
 * כהים מדי מכדי לשרוד מיהול ל-30% מעל קרם.
 *
 * הרצה: node --experimental-strip-types scripts/check-cover-colors.mjs
 */
import { toTint, rgbToHsl, rgbToHex } from '../src/lib/color.ts';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
};

const NAVY = [20, 30, 44];
const BURGUNDY = [78, 23, 26];
const GREEN = [33, 45, 30];

/* --- הגוון נשמר: זו הזהות של הכריכה --- */
for (const [name, rgb] of [['נייבי', NAVY], ['בורגונדי', BURGUNDY], ['ירוק', GREEN]]) {
  const before = rgbToHsl(rgb)[0];
  const after = rgbToHsl(toTint(rgb))[0];
  check(`${name}: הגוון נשמר`, Math.abs(before - after) < 0.02, `${before.toFixed(3)} → ${after.toFixed(3)}`);
}

/* --- הבהירות נדחפת לטווח שבו הגוון שורד מיהול --- */
for (const [name, rgb] of [['נייבי', NAVY], ['בורגונדי', BURGUNDY], ['ירוק', GREEN]]) {
  const l = rgbToHsl(toTint(rgb))[2];
  check(`${name}: בהירות בטווח 0.46–0.68`, l >= 0.455 && l <= 0.685, l.toFixed(3));
}

/* --- הלב: שלוש כריכות כהות שונות אינן מתכנסות לאותו צבע --- */
const tints = [NAVY, BURGUNDY, GREEN].map(toTint);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pairs = [[0, 1], [0, 2], [1, 2]];
const minDist = Math.min(...pairs.map(([i, j]) => dist(tints[i], tints[j])));
check(
  'שלוש כריכות כהות נשארות נבדלות זו מזו',
  minDist > 60,
  `מרחק מזערי ${minDist.toFixed(0)} · ${tints.map(rgbToHex).join(' ')}`,
);

/* --- אפור אמיתי לא מקבל גוון מומצא --- */
const grey = toTint([128, 128, 128]);
check('אפור נשאר אפור ולא מקבל צבע', rgbToHsl(grey)[1] < 0.06, rgbToHex(grey));

console.log(failures === 0 ? '\nנרמול צבעי הכריכה תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
