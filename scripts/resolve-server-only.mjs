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
  /*
   * ‏revalidatePath מתועד ב-globalThis כדי שבדיקה תוכל לאמת **כמה**
   * פעמים הוא נקרא ובאילו נתיבים — זו הטענה המרכזית של סורק הגבולות
   * ("אפס רענון כשאין שינוי"), ובלי מדידה היא רק הצהרה.
   * ‏__revalidateShouldThrow מאפשר לבדוק את מסלול הכשל.
   */
  'next/cache': `
    export const revalidatePath = (path, type) => {
      if (globalThis.__revalidateShouldThrow) throw new Error('[check] revalidatePath נכשל');
      (globalThis.__revalidateCalls ??= []).push(type ? path + '|' + type : path);
      (globalThis.__callOrder ??= []).push('path');
    };
    // תגים נרשמים ברשימה נפרדת מהנתיבים: בדיקות קיימות סופרות את הנתיבים
    // במדויק. updateTag חוקי רק בתוך Server Action ו-revalidateTag דורש
    // profile (Next 16) — הסטאב זורק כשחסר, כמו הגרסה האמיתית.
    export const revalidateTag = (tag, profile) => {
      if (profile === undefined) throw new Error('[check] revalidateTag(tag) ללא profile');
      if (globalThis.__tagShouldThrow) throw new Error('[check] revalidateTag נכשל');
      (globalThis.__tagCalls ??= []).push({ fn: 'revalidateTag', tag, profile });
      (globalThis.__callOrder ??= []).push('tag');
      // ‏expire: 0 פוקע מיד; 'max' הוא stale-while-revalidate ואינו פוקע
      if (profile && profile.expire === 0) globalThis.__onTagExpire?.(tag);
    };
    export const updateTag = (tag) => {
      if (globalThis.__tagShouldThrow) throw new Error('[check] updateTag נכשל');
      (globalThis.__tagCalls ??= []).push({ fn: 'updateTag', tag });
      (globalThis.__callOrder ??= []).push('tag');
      globalThis.__onTagExpire?.(tag);
    };
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

  // ‏'next/server' הוא תת-נתיב בלי סיומת: Next מפרק אותו בבנייה, ו-node ESM
  // דורש 'next/server.js'. נחוץ לבדיקת route handler ממשי (health).
  if (specifier === 'next/server') {
    return next('next/server.js', context);
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
