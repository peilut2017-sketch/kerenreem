/**
 * מוודא שכל שדה שהניהול כותב קיים כעמודה במסד, ושכל עמודה שהאתר הציבורי
 * מסתמך עליה ניתנת לעריכה.
 *
 * שדה שקיים בטופס ואין לו עמודה נכשל רק בזמן שמירה, עם 42703 —
 * ורק אחרי שהמשתמש מילא את כל הטופס. שדה שקיים במסד, שהאתר מסנן או ממיין
 * לפיו אבל אינו בטופס, גרוע יותר: אין שגיאה בכלל, התוכן פשוט לא מופיע
 * ואי אפשר להבין למה.
 *
 * הרצה: node --experimental-strip-types scripts/check-schema-sync.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { ENTITIES } from '../src/lib/admin/schema.ts';

/** עמודות שהמסד ממלא לבד ואין להן מקום בטופס. */
const MANAGED = new Set(['id', 'created_at', 'updated_at']);

/** שולף את שמות העמודות מכל create table שבקובצי ה-SQL. */
const notNull = new Set();

function readColumns() {
  const tables = new Map();

  for (const file of readdirSync('supabase').filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(`supabase/${file}`, 'utf8');
    const re = /create table (?:if not exists )?(\w+)\s*\(([\s\S]*?)\n\);/g;

    for (const [, table, body] of sql.matchAll(re)) {
      const columns = new Set(tables.get(table) ?? []);

      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        // דילוג על הערות ועל אילוצים ברמת הטבלה
        if (!line || line.startsWith('--')) continue;
        if (/^(primary key|unique|check|constraint|foreign key|exclude)\b/i.test(line)) continue;

        const name = line.match(/^([a-z_][a-z0-9_]*)\s+/i)?.[1];
        if (name) {
          columns.add(name);
          // עמודת not null שיש לה default נשברת דווקא כשהטופס שולח null
          // מפורש: ה-default חל רק כשהעמודה מושמטת מה-INSERT.
          if (/\bnot null\b/i.test(line)) notNull.add(`${table}.${name}`);
        }
      }

      tables.set(table, [...columns]);
    }

    // עמודות שנוספו אחרי היצירה. בלי זה כל שדה שהתווסף ב-alter table
    // נראה כאילו אין לו עמודה, והבדיקה מתריעה על תקלה שאינה קיימת.
    const alterRe =
      /alter table (\w+)\s+add column (?:if not exists )?([a-z_][a-z0-9_]*)([^;]*);/gi;
    for (const [, table, column, rest] of sql.matchAll(alterRe)) {
      const columns = new Set(tables.get(table) ?? []);
      columns.add(column);
      tables.set(table, [...columns]);
      if (/\bnot null\b/i.test(rest)) notNull.add(`${table}.${column}`);
    }
  }

  return tables;
}

const tables = readColumns();
let failures = 0;

console.log('טבלאות שנקראו מה-SQL:', [...tables.keys()].join(', '), '\n');

for (const [key, spec] of Object.entries(ENTITIES)) {
  const columns = tables.get(spec.table);

  if (!columns) {
    console.log(`✗ ${key}: הטבלה ${spec.table} לא נמצאה בקובצי ה-SQL`);
    failures += 1;
    continue;
  }

  const fieldNames = spec.fields.map((f) => f.name);
  const missing = fieldNames.filter((n) => !columns.includes(n));
  const uneditable = columns.filter((c) => !MANAGED.has(c) && !fieldNames.includes(c));

  if (missing.length === 0 && uneditable.length === 0) {
    console.log(`✓ ${key} — ${fieldNames.length} שדות, כולם קיימים במסד`);
    continue;
  }

  if (missing.length) {
    console.log(`✗ ${key}: שדות בטופס שאין להם עמודה — ${missing.join(', ')}`);
    failures += 1;
  }
  if (uneditable.length) {
    // לא כשל: יש עמודות לגיטימיות שאינן לעריכה ידנית. מדווח כדי שההחלטה
    // תהיה מודעת ולא תוצאה של שכחה.
    console.log(`  ℹ ${key}: עמודות שאינן בטופס — ${uneditable.join(', ')}`);
  }
}

/* -------------------------------------------------------------------------- */
/* שדות רשות שהעמודה שלהם not null                                             */
/* -------------------------------------------------------------------------- */
/**
 * שדה שאינו חובה בטופס נשמר כ-null כשהוא ריק. אם העמודה במסד היא not null
 * — גם כשיש לה default — ה-INSERT נכשל ב-23502, כי default חל רק כשהעמודה
 * מושמטת לגמרי ולא כשנשלח null מפורש.
 */
console.log('');
for (const [key, spec] of Object.entries(ENTITIES)) {
  const risky = spec.fields.filter(
    (field) =>
      !field.required &&
      !field.omitWhenEmpty &&
      // צ'ק־בוקס נשמר תמיד כ-true/false, ושדה מערך נשמר תמיד כמערך —
      // אולי ריק, אך לעולם לא null. שניהם אינם בסיכון 23502.
      field.type !== 'boolean' &&
      field.type !== 'text[]' &&
      notNull.has(`${spec.table}.${field.name}`),
  );
  if (risky.length) {
    console.log(`✗ ${key}: שדות רשות שהעמודה שלהם not null — ${risky.map((f) => f.name).join(', ')}`);
    failures += 1;
  }
}

/* -------------------------------------------------------------------------- */
/* עמודות שהשכבה הגנרית נוקבת בהן                                              */
/* -------------------------------------------------------------------------- */
/**
 * actions.ts משרת את כל הישויות באותו קוד, ולכן כל עמודה שהוא נוקב בשמה
 * חייבת להתקיים בכל הטבלאות. זה בדיוק מה שנשבר כשהשמירה ביקשה
 * select('id, slug') גם עבור באנרים, שאין להם מזהה כתובת: 42703 בכל שמירה.
 * ההגדרות של הישויות היו תקינות לחלוטין — הבעיה הייתה בקוד המשותף, ולכן
 * ההצלבה שלמעלה לא יכלה לתפוס אותה.
 */
const actions = readFileSync('src/lib/admin/actions.ts', 'utf8');
const generic = new Set();

// רק שרשראות שמופנות אל entity.table הן גנריות. פונקציה שפונה לטבלה
// מפורשת (למשל יצירת תגית) נוקבת בעמודות של אותה טבלה בלבד, ואין שום
// סיבה שיהיו קיימות בכל הישויות — הבדיקה התריעה עליהן בטעות.
for (const match of actions.matchAll(/from\(entity\.table\)([\s\S]{0,400}?);/g)) {
  const chain = match[1];
  for (const [, columns] of chain.matchAll(/\.select\('([^']+)'\)/g)) {
    for (const column of columns.split(',')) {
      const name = column.trim();
      if (name && name !== '*') generic.add(name);
    }
  }
  for (const [, key] of chain.matchAll(/\.update\(\{\s*(\w+):/g)) generic.add(key);
}

console.log('\nעמודות שהשכבה הגנרית נוקבת בהן:', [...generic].join(', '));

for (const column of generic) {
  // עמודה שהקוד ניגש אליה רק אחרי בדיקה שהישות מכריזה עליה כשדה אינה
  // חייבת להתקיים בכל הטבלאות. הבדיקה מאתרת את השמירה הזו בקוד במפורש,
  // כדי שהיא לא תיעלם בעריכה עתידית בלי שהבדיקה תשים לב.
  const guarded = actions.includes(`field.name === '${column}'`);

  const lacking = Object.entries(ENTITIES)
    .filter(([, spec]) => {
      const columns = tables.get(spec.table) ?? [];
      if (columns.includes(column)) return false;
      // חסרה בטבלה — פער רק אם הקוד ניגש אליה בלי שמירה
      return !(guarded && !spec.fields.some((f) => f.name === column));
    })
    .map(([key]) => key);

  if (lacking.length === 0) {
    console.log(`✓ ${column} — ${guarded ? 'מוגנת בבדיקה בקוד' : 'קיימת בכל הטבלאות'}`);
  } else {
    console.log(`✗ ${column}: חסרה ב-${lacking.join(', ')} — קוד משותף ייכשל ב-42703`);
    failures += 1;
  }
}

console.log(failures === 0 ? '\nהטפסים והמסד מסונכרנים.' : `\n${failures} אי-התאמות.`);
process.exit(failures === 0 ? 0 : 1);
