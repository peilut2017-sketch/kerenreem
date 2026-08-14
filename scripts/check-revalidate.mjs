/**
 * מוודא שכל עמוד ציבורי שמציג ישות מסוימת מרוענן כשהיא נשמרת בניהול.
 *
 * זו התקלה השקטה ביותר בכל השרשרת: השמירה מצליחה, אין שגיאה בשום מקום,
 * הישות מתעדכנת במסך אחד — ובמסך אחר נשארת הגרסה הישנה עד שפג ה-ISR.
 * הקשרים חוצי-ישויות הם המקור העיקרי: שם מחבר מוצג גם בעמוד הספר, ומניין
 * הספרים ברשימת המחברים תלוי בטבלת הספרים.
 *
 * הבדיקה גוזרת את המפה מהקוד עצמו — אילו טבלאות כל שולף נוגע בהן, ואילו
 * שולפים כל עמוד קורא — ולכן היא ממשיכה לתפוס גם עמודים שייווספו בעתיד.
 *
 * הרצה: node --experimental-strip-types scripts/check-revalidate.mjs
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { ENTITIES } from '../src/lib/admin/schema.ts';

const dataSource = readFileSync('src/lib/data.ts', 'utf8');

/** טבלאות שמצורפות דרך select משותף ולא דרך from() נפרד. */
const JOINED = { BOOK_SELECT: ['authors', 'categories'] };

/** שם שולף → הטבלאות שהוא נוגע בהן. */
function mapGettersToTables() {
  const getters = new Map();
  // כל פונקציה מיוצאת, עד תחילת הבאה אחריה
  const re = /export (?:async function|const) (\w+)[\s\S]*?(?=\nexport |\n\/\* -|$)/g;

  for (const [body, name] of dataSource.matchAll(re)) {
    const tables = new Set();
    for (const [, table] of body.matchAll(/\.from\('(\w+)'\)/g)) tables.add(table);
    for (const [constant, joined] of Object.entries(JOINED)) {
      if (body.includes(constant)) joined.forEach((t) => tables.add(t));
    }
    if (tables.size) getters.set(name, [...tables]);
  }

  return getters;
}

/** נתיב קובץ → תבנית המסלול שבה משתמש revalidatePath. */
function routeOf(file) {
  const path = file
    .replace('src/app/(public)/[locale]', '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/\([^)]+\)/g, '');
  return path;
}

const getters = mapGettersToTables();

/**
 * עמוד force-dynamic נטען מחדש בכל בקשה ואינו נכנס למטמון ISR — לכן
 * revalidatePath לא רלוונטי לו, והוא תמיד מציג נתונים טריים. ההצהרה
 * יכולה לשבת בעמוד עצמו או ב-layout כלשהו מעליו (עד שורש הציבורי),
 * ולכן בודקים את כל השרשרת. בלי ההחרגה הזו הבדיקה מדווחת פער-שווא על
 * /account (עמוד אישי, force-dynamic) שאין לו מה לרענן.
 */
const FORCE_DYNAMIC = /export\s+const\s+dynamic\s*=\s*['"]force-dynamic['"]/;
const hasForceDynamic = (file) => {
  try {
    return FORCE_DYNAMIC.test(readFileSync(file, 'utf8'));
  } catch {
    return false;
  }
};

// הסינון נעשה על המחרוזת ולא בתבנית ה-glob: '[locale]' ו-'(public)' הם
// תווים בעלי משמעות ב-glob, ותבנית שמכילה אותם מחזירה אפס קבצים בשקט.
const PUBLIC_ROOT = 'src/app/(public)/[locale]';

/** העמוד עצמו, או layout כלשהו מעליו עד שורש הציבורי, מצהיר force-dynamic. */
function isForceDynamic(pageFile) {
  if (hasForceDynamic(pageFile)) return true;
  let dir = pageFile.slice(0, pageFile.lastIndexOf('/'));
  while (dir.length >= PUBLIC_ROOT.length) {
    if (hasForceDynamic(`${dir}/layout.tsx`)) return true;
    if (dir === PUBLIC_ROOT) break;
    dir = dir.slice(0, dir.lastIndexOf('/'));
  }
  return false;
}
const pages = globSync('src/app/**/page.tsx').filter((f) => f.startsWith(PUBLIC_ROOT));

if (pages.length === 0) {
  console.error('שגיאה: לא נמצאו עמודים ציבוריים — הבדיקה אינה בודקת דבר.');
  process.exit(1);
}
if (getters.size === 0) {
  console.error('שגיאה: לא זוהו שולפים ב-data.ts — הבדיקה אינה בודקת דבר.');
  process.exit(1);
}

/** טבלה → קבוצת המסלולים שמציגים אותה. */
const tableRoutes = new Map();

for (const file of pages) {
  // עמוד force-dynamic תמיד טרי — אין לו מטמון ISR לרענן, ולכן אינו
  // מטיל דרישת revalidatePath על אף ישות שהוא מציג.
  if (isForceDynamic(file)) continue;

  const source = readFileSync(file, 'utf8');
  const route = routeOf(file);

  for (const [getter, tables] of getters) {
    // קריאה ממשית, לא רק אזכור בשם אחר
    if (!new RegExp(`\\b${getter}\\s*\\(`).test(source)) continue;
    for (const table of tables) {
      if (!tableRoutes.has(table)) tableRoutes.set(table, new Set());
      tableRoutes.get(table).add(route);
    }
  }
}

let failures = 0;

for (const [key, spec] of Object.entries(ENTITIES)) {
  const needed = tableRoutes.get(spec.table);
  if (!needed) {
    console.log(`  ℹ ${key}: אינו מוצג באף עמוד ציבורי`);
    continue;
  }

  const declared = new Set(spec.revalidate);
  const missing = [...needed].filter((route) => !declared.has(route));

  if (missing.length === 0) {
    console.log(`✓ ${key} — מרענן את כל ${needed.size} המסלולים שמציגים אותו`);
  } else {
    console.log(
      `✗ ${key}: מוצג ב-${missing.map((r) => r || '/ (בית)').join(', ')} אך אינו מרענן אותם`,
    );
    failures += 1;
  }
}

console.log(failures === 0 ? '\nכל שמירה מרעננת את כל מקומות התצוגה.' : `\n${failures} פערי רענון.`);
process.exit(failures === 0 ? 0 : 1);
