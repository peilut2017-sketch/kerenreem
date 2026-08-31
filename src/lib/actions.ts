'use server';

import { headers } from 'next/headers';
import { incrementBookView } from './data';
import { allowRequest, ipBucket } from './commerce/rate-limit';

/**
 * Server Actions ציבוריים — לא ניהוליים. אין כאן בדיקת הרשאה כי כל
 * מבקר רשאי להפעיל את אלה; ה-RLS וה-security definer שמאחורי כל אחת
 * מהן הם קו ההגנה, לא הקוד כאן.
 */

/** נקרא פעם אחת מ-<ViewTracker> בטעינת עמוד ספר. ראו incrementBookView לסיבה שזה Server Action ולא קריאה בתוך הרינדור. */
export async function recordBookView(slug: string): Promise<void> {
  if (typeof slug !== 'string' || !slug || slug.length > 200) return;
  // הגבלת קצב נדיבה: המונה מזין את שורת "הנצפים ביותר" בעמוד הבית,
  // כך שבלי זה אפשר לנפח את דירוג הספר בלולאה. fail-open.
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('book-view', headerList), 240, 60))) return;
  await incrementBookView(slug);
}
