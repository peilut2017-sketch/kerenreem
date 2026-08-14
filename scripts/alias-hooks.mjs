/**
 * Hook פתרון-מודולים ל-runner של בדיקות ה-node העצמאיות: ממפה את ה-alias
 * ‎@/…‎ (שמוגדר ב-tsconfig ומובן ל-Next/TS אך לא ל-node החשוף) אל
 * ‎src/…‎, ומוסיף סיומת .ts כשהיא חסרה. בלעדיו, בדיקה שמייבאת מודול
 * מקור עם ‎@/…‎ (למשל check-sanitize על sanitize.ts) קורסת ב-
 * ERR_MODULE_NOT_FOUND עוד לפני שרצה בדיקה אחת.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    let target = new URL(specifier.slice(2), SRC);
    // '@/lib/image-src' → src/lib/image-src.ts (הוספת הסיומת כשחסרה)
    if (!/\.[a-z0-9]+$/i.test(specifier)) {
      const withTs = new URL(`${target.href}.ts`);
      if (existsSync(fileURLToPath(withTs))) target = withTs;
    }
    return nextResolve(target.href, context);
  }
  return nextResolve(specifier, context);
}
