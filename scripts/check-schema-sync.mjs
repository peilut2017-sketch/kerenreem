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
        if (name) columns.add(name);
      }

      tables.set(table, [...columns]);
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

console.log(failures === 0 ? '\nהטפסים והמסד מסונכרנים.' : `\n${failures} אי-התאמות.`);
process.exit(failures === 0 ? 0 : 1);
