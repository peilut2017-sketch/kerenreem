'use server';

import { incrementBookView } from './data';

/**
 * Server Actions ציבוריים — לא ניהוליים. אין כאן בדיקת הרשאה כי כל
 * מבקר רשאי להפעיל את אלה; ה-RLS וה-security definer שמאחורי כל אחת
 * מהן הם קו ההגנה, לא הקוד כאן.
 */

/** נקרא פעם אחת מ-<ViewTracker> בטעינת עמוד ספר. ראו incrementBookView לסיבה שזה Server Action ולא קריאה בתוך הרינדור. */
export async function recordBookView(slug: string): Promise<void> {
  await incrementBookView(slug);
}
