/**
 * בדיקת שפיות למודול התאריכים העבריים.
 * הרצה: node scripts/check-hebrew-dates.mjs
 *
 * לא מחליף מערכת בדיקות, אבל מוודא שההמרות המרכזיות נכונות אחרי שדרוג
 * של @hebcal/core או שינוי בעיצוב התאריך.
 */
import { HDate, Locale, gematriya } from '@hebcal/core';

function toHebrewDate(date, afterSunset = false) {
  const hd = new HDate(date);
  const effective = afterSunset ? hd.next() : hd;
  const monthKey = HDate.getMonthName(effective.getMonth(), effective.getFullYear());
  const monthName = Locale.gettext(monthKey, 'he-x-NoNikud') || monthKey;
  return `${gematriya(effective.getDate())} ב${monthName} ${gematriya(effective.getFullYear())}`;
}

const cases = [
  // [שנה, חודש(0-11), יום, ציפייה]
  [2026, 6, 29, 'ט״ו באב תשפ״ו'],       // ט"ו באב — יום הזיכרון השנתי של הקרן
  [2025, 8, 23, 'א׳ בתשרי תשפ״ו'],       // ראש השנה תשפ"ו
  [1993, 0, 1, 'ח׳ בטבת תשנ״ג'],         // שנת ההקמה
  [2024, 2, 24, 'י״ד באדר ב׳ תשפ״ד'],    // פורים בשנה מעוברת
];

let failures = 0;

for (const [year, month, day, expected] of cases) {
  const actual = toHebrewDate(new Date(year, month, day));
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? '✓' : '✗'} ${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} → ${actual}${ok ? '' : `  (ציפייה: ${expected})`}`);
}

// החלפת יום בשקיעה: אירוע ערב שייך לתאריך העברי של המחרת
const evening = toHebrewDate(new Date(2026, 6, 29), true);
console.log(`  אחרי שקיעה באותו יום → ${evening}`);
if (evening === toHebrewDate(new Date(2026, 6, 29))) {
  console.log('✗ דגל afterSunset לא שינה את התאריך');
  failures += 1;
} else {
  console.log('✓ דגל afterSunset מקדם יום אחד');
}

process.exit(failures === 0 ? 0 : 1);
