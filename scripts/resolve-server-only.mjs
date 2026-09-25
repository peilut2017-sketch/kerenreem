/**
 * ‏hook רזולוציה לסקריפטי הבדיקה.
 *
 * שני דברים ש-Next עושה בבנייה וש-node אינו יודע לבד: הכינוי '@/'
 * (‏paths ב-tsconfig) והמודול הווירטואלי 'server-only'.
 *
 * ‏'server-only' אינו חבילה אמיתית ב-node_modules — Next מפרק אותו
 * בבנייה כדי לחסום ייבוא של קוד שרת אל חבילת הדפדפן. סקריפט בדיקה
 * שרץ ב-node ישר על ה-TS לא עובר דרך Next, ולכן הייבוא נכשל.
 *
 * הפתרון אינו להסיר את השמירה מהקוד — היא נחוצה בייצור — אלא למפות
 * אותה כאן למודול ריק, בסקריפט הבדיקה בלבד.
 */
const STUBBED = new Set(['server-only', 'client-only']);

/**
 * מודולים של Next שדורשים הקשר בקשה. סקריפט בדיקה שרץ ב-node אינו
 * בתוך בקשה, ולכן הם מוחלפים בגרסאות שזורקות — אם קוד שנבדק *כן* קורא
 * להם, הבדיקה תיפול ברעש ולא תעבור בשקט על מסלול לא נבדק.
 */
const NEXT_STUBS = {
  'next/headers': `
    const fail = (name) => { throw new Error('[check] ' + name + '() אינו זמין מחוץ לבקשה'); };
    export const cookies = () => fail('cookies');
    export const headers = () => fail('headers');
    export const draftMode = () => fail('draftMode');
  `,
  'next/cache': `
    export const revalidatePath = () => {};
    export const revalidateTag = () => {};
    export const unstable_cache = (fn) => fn;
  `,
};

/** שורש הפרויקט — הקובץ הזה יושב ב-scripts/, ולכן רמה אחת מעליו. */
const SRC = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, next) {
  if (STUBBED.has(specifier)) {
    return { shortCircuit: true, url: 'data:text/javascript,export {}' };
  }

  const stub = NEXT_STUBS[specifier];
  if (stub) {
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(stub)}`,
    };
  }

  // הכינוי '@/…' → 'src/…', כמו ב-tsconfig.paths. הסיומת מטופלת
  // בהמשך על ידי אותה נפילה של הייבוא היחסי.
  if (specifier.startsWith('@/')) {
    const path = specifier.slice(2);
    const target = new URL(path, SRC).href;
    for (const candidate of [`${target}.ts`, `${target}.tsx`, target, `${target}/index.ts`]) {
      try {
        return await next(candidate, context);
      } catch {
        // הבא בתור
      }
    }
  }

  // ‏TypeScript מייבא בלי סיומת ("./addresses"); node דורש נתיב מלא.
  // רק לייבוא יחסי, וכ-fallback: קובץ .js קיים ייפתר קודם כרגיל.
  if (/^\.{1,2}\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // ממשיכים לרזולוציה הרגילה, כדי שהשגיאה תהיה המקורית.
    }
  }

  return next(specifier, context);
}
