/**
 * ‏hook רזולוציה לסקריפטי הבדיקה.
 *
 * ‏'server-only' אינו חבילה אמיתית ב-node_modules — Next מפרק אותו
 * בבנייה כדי לחסום ייבוא של קוד שרת אל חבילת הדפדפן. סקריפט בדיקה
 * שרץ ב-node ישר על ה-TS לא עובר דרך Next, ולכן הייבוא נכשל.
 *
 * הפתרון אינו להסיר את השמירה מהקוד — היא נחוצה בייצור — אלא למפות
 * אותה כאן למודול ריק, בסקריפט הבדיקה בלבד.
 */
const STUBBED = new Set(['server-only', 'client-only']);

export async function resolve(specifier, context, next) {
  if (STUBBED.has(specifier)) {
    return { shortCircuit: true, url: 'data:text/javascript,export {}' };
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
