import 'server-only';
import { isLegacyStorageUrl, toCdnUrl } from './image-src';

/**
 * שליפת קובץ בצד שרת מכתובת שמקורה במסד — הצינור היחיד המותר לכך.
 *
 * כתובות אחסון נשמרות במסד כ-URL אבסולוטי (ראו uploadToBucket), ולכן
 * ערך שנשמר לפני מעבר ספק מצביע על מארח שכבר אינו קיים. כל fetch ישיר
 * של ערך כזה מהשרת נגמר ב-getaddrinfo ENOTFOUND בלוגים של פרודקשן —
 * בדיוק התקלה שהפונקציה הזו קיימת למנוע. לכן שלושה כללים, לפי הסדר:
 *
 *  1. נרמול קודם לכל: toCdnUrl מיישרת כתובת מורשת לבסיס הנוכחי —
 *     אותה פונקציה יחידה שמשמשת גם את שכבת התצוגה (Img, sanitize).
 *  2. שומר קשיח: אם גם אחרי היישור הכתובת יושבת על מארח מורשת (אין
 *     בסיס נוכחי בסביבה, או נתיב שאינו אחסון ציבורי) — לא יוצאת שום
 *     פניית רשת. קובץ חסר עדיף על פנייה למארח מת. אין כאן fallback
 *     שמנסה את המארח הישן "ליתר ביטחון" — בכוונה.
 *  3. תקציב זמן: מארח שעונה לאט (או לא עונה) לא תוקע את הרינדור —
 *     AbortSignal.timeout קוטע, והכישלון חוזר כ-null שקט שהקוראים
 *     כבר יודעים ליפול ממנו לברירת מחדל.
 *
 * כל קוד שרת חדש שצריך בייטים של קובץ מכתובת שמורה עובר מכאן — לא
 * fetch ישיר. כך הכללים נאכפים פעם אחת ולא משוכפלים בכל נקודת שימוש.
 */

export interface FetchedStoredFile {
  bytes: Buffer;
  contentType: string | null;
}

export async function fetchStoredFile(
  url: string,
  { timeoutMs = 8_000 }: { timeoutMs?: number } = {},
): Promise<FetchedStoredFile | null> {
  const resolved = toCdnUrl(url);
  if (isLegacyStorageUrl(resolved)) {
    console.warn(`[storage-fetch] כתובת על מארח אחסון ישן שאין לו תחליף מוגדר — מדולגת: ${resolved}`);
    return null;
  }

  try {
    const response = await fetch(resolved, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type'),
    };
  } catch (error) {
    console.warn(`[storage-fetch] שליפה נכשלה עבור ${resolved}`, error);
    return null;
  }
}
