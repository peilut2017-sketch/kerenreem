import { revalidateTag, updateTag } from 'next/cache';

/**
 * תג מטמון-הנתונים של תוכן ציבורי שנשמר במכוון (createContentClient).
 *
 * רק שליפות תוכן ב-data.ts נושאות אותו. מחיר ומלאי חיים, עגלה, משלוח,
 * הגדרות חנות, health ו-diagnostics אינם במטמון הזה בכלל — ראו
 * lib/supabase/server.ts.
 */
export const PUBLIC_CONTENT_CACHE_TAG = 'sb:public';

/**
 * ביטול מיידי מתוך Server Action, אחרי שמירה שכבר הצליחה במסד.
 *
 * ‏updateTag חוקי רק בתוך Server Action. כשל כאן נרשם ולא נזרק: שמירה
 * שהצליחה לא אמורה להיראות ככישלון בגלל רענון, ובאותה רוח revalidateEntity
 * בולעת שגיאות רענון. ההחזרה מאפשרת לבדיקה להבחין בין שתי התוצאות.
 */
export function expirePublicContentAfterSave(): boolean {
  try {
    updateTag(PUBLIC_CONTENT_CACHE_TAG);
    return true;
  } catch (error) {
    console.error('[content-cache] updateTag', error);
    return false;
  }
}

/**
 * ביטול מיידי מתוך Route Handler (הקרון). updateTag אסור שם.
 *
 * ‏{ expire: 0 } ולא 'max': 'max' מגיש תוכן ישן בזמן שהחדש נשלף ברקע,
 * וקרון שמרענן עמוד כדי שיציג שינוי חייב לקבל את הנתון החדש בפעם הראשונה.
 *
 * לא בולע שגיאות: הקרון מחליט בעצמו שכשל בביטול משאיר את הסמן במקומו
 * ומנסה שוב בריצה הבאה (ראו runBoundaryRevalidation).
 */
export function expirePublicContentNow(): void {
  revalidateTag(PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
}
