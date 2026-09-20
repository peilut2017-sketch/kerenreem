/**
 * כתובת ה-IP של הפונה מכותרות ה-proxy — מקור אחד לכל הצרכנים.
 *
 * הסדר חשוב: x-forwarded-for היא רשימה שהלקוח יכול *להתחיל* בעצמו
 * (הפרוקסי מוסיף בסופה), ולכן הערך הראשון בה נשלט בידי הפונה — מי
 * שמסובב אותו מאפס כל דלי הגבלת-קצב שנשען עליו. לכן:
 *  1. cf-connecting-ip — נכתבת בידי Cloudflare כשהאתר מוגש דרכו, ואינה
 *     ניתנת לזיוף מבחוץ.
 *  2. x-real-ip — נכתבת בידי הפלטפורמה (Vercel) מכתובת החיבור בפועל.
 *  3. הערך *האחרון* ב-x-forwarded-for — זה שהפרוקסי הקרוב ביותר הוסיף,
 *     לא הראשון שהלקוח יכול היה לשתול.
 *
 * עדיין לא ראיה לזהות ולעולם לא בסיס להרשאה — רק מפתח לספירה ולהגבלת
 * קצב, שעכשיו לפחות אינו ניתן לאיפוס בכותרת אחת.
 */
export function clientIp(headers: Headers): string {
  const direct = headers.get('cf-connecting-ip')?.trim() || headers.get('x-real-ip')?.trim();
  if (direct) return direct;
  const forwarded = headers
    .get('x-forwarded-for')
    ?.split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded?.at(-1) || 'unknown';
}
